"""
End-to-end test: Verify a team can complete a task from start to finish.

This test:
1. Creates a minimal team (if needed)
2. Plans task delegation
3. Executes the full crew
4. Verifies completion
5. Shows the final output
"""

import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from planner import plan_task_delegation
from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools

_dir = Path(__file__).parent


def ensure_minimal_team():
    """Create a minimal team if one doesn't exist."""
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if agents_path.exists() and tasks_path.exists():
        print("✅ Using existing team configuration")
        return True

    print("⚠️  No team found. Creating minimal test team...")

    # Minimal 2-agent team for testing
    minimal_agents = {
        "leader": {
            "role": "Leader",
            "goal": "Coordinate the team and ensure task completion",
            "backstory": "An experienced team leader who manages workflow and delegates tasks effectively.",
            "tools": []
        },
        "researcher": {
            "role": "Researcher",
            "goal": "Research topics and gather information",
            "backstory": "A skilled researcher who finds relevant information quickly.",
            "tools": ["web_search"]
        },
        "writer": {
            "role": "Writer",
            "goal": "Write clear and concise content",
            "backstory": "A talented writer who creates well-structured content.",
            "tools": []
        }
    }

    minimal_tasks = {
        "leader_task": {
            "description": "Coordinate the team for: {prompt}",
            "expected_output": "Confirmation of task completion",
            "agent": "leader"
        },
        "researcher_task": {
            "description": "Research the following topic: {prompt}",
            "expected_output": "A brief summary of key findings (2-3 sentences)",
            "agent": "researcher"
        },
        "writer_task": {
            "description": "Write a short response based on the research for: {prompt}",
            "expected_output": "A concise written response (1 paragraph)",
            "agent": "writer"
        }
    }

    with open(agents_path, "w") as f:
        yaml.dump(minimal_agents, f, sort_keys=False)

    with open(tasks_path, "w") as f:
        yaml.dump(minimal_tasks, f, sort_keys=False)

    print("✅ Minimal team created")
    return True


def test_task_completion():
    """Test that a team can complete a task end-to-end."""

    print("\n" + "=" * 70)
    print("END-TO-END TASK COMPLETION TEST")
    print("=" * 70)

    # Step 1: Ensure team exists
    print("\n[1/5] Checking team configuration...")
    if not ensure_minimal_team():
        return False

    # Load team
    with open(_dir / "agents.yaml") as f:
        agents_config = yaml.safe_load(f)

    with open(_dir / "tasks.yaml") as f:
        tasks_config = yaml.safe_load(f)

    print(f"      Team: {len(agents_config)} agents, {len(tasks_config)} tasks")

    # Step 2: Create delegation plan
    # Use a SIMPLE task to ensure quick completion
    test_task = "What are the main benefits of renewable energy? Keep it brief."

    print(f"\n[2/5] Creating delegation plan...")
    print(f"      Task: {test_task}")

    delegation_result = plan_task_delegation(test_task)

    if delegation_result["type"] == "error":
        print(f"      ❌ Failed: {delegation_result['message']}")
        return False

    plan = delegation_result["plan"]
    planned_tasks = plan.get("tasks", [])
    print(f"      ✅ Plan created: {len(planned_tasks)} tasks")

    # Show plan
    for task in planned_tasks:
        task_key = task["task_key"]
        async_exec = task.get("async_execution", False)
        deps = task.get("dependencies", [])
        status = "⚡ parallel" if (async_exec and not deps) else "⏸ sequential"
        print(f"         {status}: {task_key}")

    # Step 3: Build agents
    print(f"\n[3/5] Building agents...")

    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break

    if not leader_key:
        print("      ❌ No leader found")
        return False

    agents = {}
    worker_agents = []
    leader_agent = None

    for key, config in agents_config.items():
        is_leader = (key == leader_key)
        agent_tools = instantiate_tools(config.get("tools", []))

        agent = Agent(
            role=config["role"],
            goal=config["goal"],
            backstory=config["backstory"],
            verbose=False,  # Less verbose for cleaner output
            llm=LLM(
                model="claude-sonnet-4-5-20250929",
                api_key=os.environ.get("ANTHROPIC_API_KEY")
            ),
            tools=agent_tools,
            allow_delegation=is_leader,
        )

        agents[key] = agent
        print(f"      {'👑' if is_leader else '🤖'} {key}")

        if is_leader:
            leader_agent = agent
        else:
            worker_agents.append(agent)

    # Step 4: Build tasks
    print(f"\n[4/5] Building tasks from plan...")

    crew_tasks = []
    task_map = {}

    for plan_entry in planned_tasks:
        task_key = plan_entry["task_key"]
        async_execution = plan_entry.get("async_execution", False)
        dependencies = plan_entry.get("dependencies", [])

        if task_key not in tasks_config:
            continue

        config = tasks_config[task_key]
        agent_key = config["agent"]

        if agent_key == leader_key:
            continue  # Skip leader task

        desc = config["description"]
        if "{prompt}" not in desc:
            desc += "\n\nUser's request: {prompt}"

        # Build context
        context_tasks = [task_map[dep] for dep in dependencies if dep in task_map]

        task = Task(
            description=desc.format(prompt=test_task),
            expected_output=config["expected_output"],
            agent=agents[agent_key],
            async_execution=async_execution,
            context=context_tasks if context_tasks else None,
        )

        crew_tasks.append(task)
        task_map[task_key] = task
        print(f"      ✓ {task_key}")

    # Step 5: Execute crew
    print(f"\n[5/5] Executing crew...")
    print("      " + "-" * 60)

    try:
        crew = Crew(
            agents=worker_agents,
            tasks=crew_tasks,
            process=Process.hierarchical,
            manager_agent=leader_agent,
            planning=False,
            verbose=True,
        )

        print("      ⏳ Running... (this may take 1-2 minutes)")
        result = crew.kickoff()
        print("      " + "-" * 60)
        print("      ✅ Execution complete!")

        # Show result
        print("\n" + "=" * 70)
        print("FINAL RESULT")
        print("=" * 70)
        print(str(result))
        print("=" * 70)

        # Verify completion
        print("\n✅ TASK COMPLETED SUCCESSFULLY!")
        print("   • Delegation plan created")
        print("   • Agents built and configured")
        print("   • Tasks executed")
        print("   • Final output generated")

        return True

    except Exception as e:
        print(f"\n❌ EXECUTION FAILED!")
        print(f"   Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n🧪 Testing end-to-end task completion...")
    print("   This will run a REAL task with LLM calls")
    print("   Estimated time: 1-2 minutes\n")

    try:
        success = test_task_completion()

        print("\n" + "=" * 70)
        if success:
            print("✅ SUCCESS: Team completed task from start to finish!")
        else:
            print("❌ FAILED: Task did not complete")
        print("=" * 70)

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
