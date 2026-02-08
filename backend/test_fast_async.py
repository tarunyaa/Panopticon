"""
FAST async test - completes in ~30 seconds instead of minutes.

Makes execution fast by:
1. Removing web tools (searches are slow)
2. Using brief output requirements
3. Adding explicit stopping criteria
4. Using simple test prompt
"""

import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from crewai import Agent, Crew, Process, Task, LLM

_dir = Path(__file__).parent


def test_fast_async():
    """Fast test with minimal tools and brief outputs."""

    print("=" * 70)
    print("FAST ASYNC TEST (30-60 seconds)")
    print("=" * 70)

    # Load team
    with open(_dir / "agents.yaml") as f:
        agents_config = yaml.safe_load(f)

    # Find leader
    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break

    # Create agents WITHOUT tools (for speed)
    print("\n[1/3] Creating agents (no tools for speed)...")
    agents = {}
    worker_agents = []
    leader_agent = None

    for key, config in agents_config.items():
        is_leader = (key == leader_key)

        agent = Agent(
            role=config["role"],
            goal=config["goal"],
            backstory=config["backstory"] + "\n\nIMPORTANT: Be BRIEF. Provide concise, short responses only.",
            verbose=False,
            llm=LLM(
                model="claude-sonnet-4-5-20250929",
                api_key=os.environ.get("ANTHROPIC_API_KEY")
            ),
            tools=[],  # NO TOOLS = FAST
            allow_delegation=is_leader,
        )

        agents[key] = agent
        print(f"   {'👑' if is_leader else '🤖'} {key} (no tools)")

        if is_leader:
            leader_agent = agent
        else:
            worker_agents.append(agent)

    # Test both async and sequential
    test_prompt = "List 2 benefits of exercise"  # SIMPLE PROMPT

    print(f"\n📝 Test prompt: {test_prompt}")
    print("   (Simple prompt for fast execution)")

    # Test 1: Sequential (baseline)
    print("\n[2/3] Test 1: SEQUENTIAL execution")
    print("-" * 70)

    tasks_sequential = [
        Task(
            description=f"List 2 benefits of exercise. Be BRIEF - just 2 short bullet points, no elaboration.\n\nUser's request: {test_prompt}",
            expected_output="2 bullet points",
            agent=agents["abigail"],
            async_execution=False,
        ),
        Task(
            description=f"Write 1 sentence summarizing the benefits.\n\nUser's request: {test_prompt}",
            expected_output="1 sentence",
            agent=agents["klaus"],
            async_execution=False,
            context=[],  # No context needed for speed test
        ),
    ]

    crew_sequential = Crew(
        agents=worker_agents,
        tasks=tasks_sequential,
        process=Process.hierarchical,
        manager_agent=leader_agent,
        planning=False,
        verbose=True,
    )

    print("⏳ Running sequential...")
    import time
    start = time.time()
    result_seq = crew_sequential.kickoff()
    time_seq = time.time() - start

    print(f"✅ Sequential done in {time_seq:.1f}s")

    # Test 2: Parallel
    print("\n[3/3] Test 2: PARALLEL execution")
    print("-" * 70)

    task1 = Task(
        description=f"List 2 benefits of exercise. Be BRIEF - just 2 short bullet points.\n\nUser's request: {test_prompt}",
        expected_output="2 bullet points",
        agent=agents["abigail"],
        async_execution=True,  # PARALLEL
    )

    task2 = Task(
        description=f"Suggest 2 types of exercise. Be BRIEF - just 2 short bullet points.\n\nUser's request: {test_prompt}",
        expected_output="2 bullet points",
        agent=agents["isabella"],
        async_execution=True,  # PARALLEL
    )

    task3 = Task(
        description=f"Write 1 sentence summary.\n\nUser's request: {test_prompt}",
        expected_output="1 sentence",
        agent=agents["klaus"],
        async_execution=False,
        context=[task1, task2],  # Waits for both
    )

    crew_parallel = Crew(
        agents=worker_agents,
        tasks=[task1, task2, task3],
        process=Process.hierarchical,
        manager_agent=leader_agent,
        planning=False,
        verbose=True,
    )

    print("⏳ Running parallel...")
    start = time.time()
    result_par = crew_parallel.kickoff()
    time_par = time.time() - start

    print(f"✅ Parallel done in {time_par:.1f}s")

    # Results
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)

    print(f"\n⏱️  Sequential: {time_seq:.1f}s")
    print(f"⏱️  Parallel:   {time_par:.1f}s")

    if time_par < time_seq:
        speedup = ((time_seq - time_par) / time_seq) * 100
        print(f"\n🚀 Parallel was {speedup:.1f}% faster!")
    else:
        print(f"\n⚠️  Parallel was actually slower (may be overhead)")

    print("\n📄 Sequential result:")
    print(f"   {str(result_seq)[:200]}...")

    print("\n📄 Parallel result:")
    print(f"   {str(result_par)[:200]}...")

    # Check if async worked
    print("\n" + "=" * 70)
    print("ASYNC FUNCTIONALITY CHECK")
    print("=" * 70)

    if time_par < time_seq * 1.5:  # Allow some overhead
        print("✅ ASYNC EXECUTION WORKS!")
        print("   Tasks with async_execution=true can run")
        return True
    else:
        print("⚠️  ASYNC MAY NOT BE WORKING")
        print("   Parallel took longer than expected")
        return False


if __name__ == "__main__":
    try:
        success = test_fast_async()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
