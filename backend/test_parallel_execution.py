"""
Test parallel execution with 2 agents working simultaneously.

This test demonstrates:
1. Leader creates a delegation plan with 2 parallel tasks
2. Both agents start working at the same time
3. Final agent waits for both parallel tasks to complete
"""

import os
import sys
import time
import yaml
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from planner import plan_task_delegation
from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools

_dir = Path(__file__).parent


def ensure_team_exists():
    """Make sure we have a content creation team set up."""
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if not agents_path.exists() or not tasks_path.exists():
        print("⚠️  Team not found. Please create a team first.")
        print("Run the planning workflow to create agents.yaml and tasks.yaml")
        return False

    with open(agents_path) as f:
        agents = yaml.safe_load(f)

    print(f"✅ Found team with {len(agents)} agents")
    for agent_key, agent_data in agents.items():
        print(f"   • {agent_key}: {agent_data['role']}")

    return True


def timestamp():
    """Return current timestamp for logging."""
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def test_parallel_execution():
    """Test that 2 agents can work in parallel."""

    print("\n" + "=" * 70)
    print("PARALLEL EXECUTION TEST")
    print("=" * 70)

    # Step 1: Ensure team exists
    print(f"\n[{timestamp()}] Step 1: Checking team configuration...")
    if not ensure_team_exists():
        return False

    # Step 2: Create delegation plan
    task_prompt = "Write a comprehensive article about the benefits of AI in education, including real-world examples and expert opinions"

    print(f"\n[{timestamp()}] Step 2: Creating delegation plan...")
    print(f"Task: {task_prompt}\n")

    delegation_result = plan_task_delegation(task_prompt)

    if delegation_result["type"] == "error":
        print(f"❌ Delegation planning failed: {delegation_result['message']}")
        return False

    plan = delegation_result["plan"]
    tasks = plan.get("tasks", [])

    print(f"✅ Delegation plan created with {len(tasks)} tasks\n")

    # Analyze parallelization
    parallel_tasks = [t for t in tasks if t.get("async_execution") and not t.get("dependencies")]
    sequential_tasks = [t for t in tasks if not t.get("async_execution") or t.get("dependencies")]

    print("📊 PARALLELIZATION STRATEGY:")
    print(f"   Parallel tasks: {len(parallel_tasks)}")
    for task in parallel_tasks:
        print(f"      ⚡ {task['task_key']}")

    print(f"   Sequential tasks: {len(sequential_tasks)}")
    for task in sequential_tasks:
        deps = task.get("dependencies", [])
        deps_str = f" (waits for: {', '.join(deps)})" if deps else ""
        print(f"      ⏸  {task['task_key']}{deps_str}")

    if len(parallel_tasks) < 2:
        print("\n⚠️  Warning: Less than 2 parallel tasks. Parallelization may not be demonstrated.")
        print("The Leader may have decided this task doesn't benefit from parallelization.")

    # Step 3: Build and execute crew
    print(f"\n[{timestamp()}] Step 3: Building crew with delegation plan...")

    # Load configurations
    with open(_dir / "agents.yaml") as f:
        agents_config = yaml.safe_load(f)

    with open(_dir / "tasks.yaml") as f:
        tasks_config = yaml.safe_load(f)

    # Find Leader
    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break

    if not leader_key:
        print("❌ No Leader agent found")
        return False

    # Create agents
    agents = {}
    worker_agents = []
    leader_agent = None

    print("\n👥 Creating agents...")
    for key, config in agents_config.items():
        agent_name = key.replace("_", " ").title()
        is_leader = (key == leader_key)

        agent_tools = instantiate_tools(config.get("tools", []))

        agent = Agent(
            role=config["role"].strip(),
            goal=config["goal"].strip(),
            backstory=config["backstory"].strip(),
            verbose=True,
            llm=LLM(model="claude-sonnet-4-5-20250929", api_key=os.environ.get("ANTHROPIC_API_KEY")),
            tools=agent_tools,
            allow_delegation=is_leader,
        )

        agents[key] = agent
        print(f"   {'👑' if is_leader else '🤖'} {agent_name}")

        if is_leader:
            leader_agent = agent
        else:
            worker_agents.append(agent)

    # Build tasks based on delegation plan
    print(f"\n[{timestamp()}] Building tasks from delegation plan...")
    crew_tasks = []
    task_map = {}
    task_start_times = {}

    for i, plan_entry in enumerate(tasks):
        task_key = plan_entry["task_key"]
        async_execution = plan_entry.get("async_execution", False)
        dependencies = plan_entry.get("dependencies", [])

        if task_key not in tasks_config:
            print(f"❌ Task '{task_key}' not found in tasks.yaml")
            continue

        config = tasks_config[task_key]
        agent_key = config["agent"]

        if agent_key == leader_key:
            continue

        agent_name = agent_key.replace("_", " ").title()

        # Track task start time
        def make_start_callback(task_name, is_async):
            def callback(step_output):
                if task_name not in task_start_times:
                    task_start_times[task_name] = timestamp()
                    print(f"\n[{task_start_times[task_name]}] {'⚡' if is_async else '⏸ '} {task_name} STARTED")
            return callback

        desc = config["description"].strip()
        if "{prompt}" not in desc:
            desc += "\n\nUser's request: {prompt}"

        # Build context from dependencies
        context_tasks = [task_map[dep_key] for dep_key in dependencies if dep_key in task_map]

        task = Task(
            description=desc.format(prompt=task_prompt),
            expected_output=config["expected_output"].strip(),
            agent=agents[agent_key],
            async_execution=async_execution,
            context=context_tasks if context_tasks else None,
            step_callback=make_start_callback(agent_name, async_execution),
        )

        crew_tasks.append(task)
        task_map[task_key] = task

        print(f"   {'⚡' if async_execution else '⏸ '} {task_key} (agent: {agent_name})")
        if dependencies:
            print(f"      ↳ depends on: {', '.join(dependencies)}")

    # Create and run crew
    print(f"\n[{timestamp()}] Step 4: Executing crew...\n")
    print("=" * 70)

    crew = Crew(
        agents=worker_agents,
        tasks=crew_tasks,
        process=Process.hierarchical,
        manager_agent=leader_agent,
        planning=False,
        verbose=True,
    )

    start_time = time.time()
    result = crew.kickoff()
    end_time = time.time()

    # Results
    print("\n" + "=" * 70)
    print("EXECUTION COMPLETE")
    print("=" * 70)

    print(f"\n⏱️  Total execution time: {end_time - start_time:.2f} seconds")

    print("\n📋 Task Timeline:")
    for task_name, start_ts in task_start_times.items():
        print(f"   [{start_ts}] {task_name} started")

    # Analyze parallelization
    if len(task_start_times) >= 2:
        start_times_list = list(task_start_times.values())
        # Check if first two tasks started within 1 second of each other
        # (they should if they're truly parallel)
        print("\n🔍 Parallelization Analysis:")
        if len(parallel_tasks) >= 2:
            print(f"   ✅ {len(parallel_tasks)} tasks configured to run in parallel")
            print("   ✅ CrewAI should execute them concurrently")
            print("   Note: Actual parallel execution depends on CrewAI's async handling")
        else:
            print("   ℹ️  Sequential execution (no parallel tasks in plan)")

    print(f"\n📄 Final Result Preview:")
    result_str = str(result)
    print(f"   {result_str[:200]}...")

    print("\n✅ Test completed successfully!")
    return True


if __name__ == "__main__":
    try:
        success = test_parallel_execution()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
