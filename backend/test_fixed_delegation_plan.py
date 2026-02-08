"""
Test with a FIXED delegation plan to isolate async_execution issues.

This test:
1. Uses a hardcoded delegation_plan.yaml (skips delegation planning)
2. Tests both async=true and async=false modes
3. Helps identify if async_execution is the problem
"""

import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools

_dir = Path(__file__).parent


def create_test_delegation_plans():
    """Create two test plans: one with async, one without."""

    # Plan A: WITH async_execution (test if parallel works)
    # Abigail and Isabella work in parallel, Klaus waits for both
    plan_with_async = {
        "tasks": [
            {
                "task_key": "abigail_task",  # Researcher
                "async_execution": True,
                "dependencies": []
            },
            {
                "task_key": "isabella_task",  # Strategist
                "async_execution": True,
                "dependencies": []
            },
            {
                "task_key": "klaus_task",  # Writer
                "async_execution": False,
                "dependencies": ["abigail_task", "isabella_task"]
            }
        ]
    }

    # Plan B: WITHOUT async_execution (control - sequential)
    plan_without_async = {
        "tasks": [
            {
                "task_key": "abigail_task",
                "async_execution": False,
                "dependencies": []
            },
            {
                "task_key": "isabella_task",
                "async_execution": False,
                "dependencies": ["abigail_task"]
            },
            {
                "task_key": "klaus_task",
                "async_execution": False,
                "dependencies": ["abigail_task", "isabella_task"]
            }
        ]
    }

    return plan_with_async, plan_without_async


def ensure_team_exists():
    """Check that team configuration exists."""
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if not agents_path.exists() or not tasks_path.exists():
        print("❌ Team configuration not found!")
        print("   Please ensure agents.yaml and tasks.yaml exist")
        return False

    return True


def test_with_delegation_plan(plan_name, delegation_plan, test_task):
    """Test execution with a specific delegation plan."""

    print(f"\n{'=' * 70}")
    print(f"TEST: {plan_name}")
    print(f"{'=' * 70}")

    # Show plan
    print("\nDelegation Plan:")
    for i, task in enumerate(delegation_plan["tasks"], 1):
        async_str = "✅ TRUE" if task["async_execution"] else "❌ FALSE"
        deps_str = f"depends on: {task['dependencies']}" if task["dependencies"] else "no dependencies"
        print(f"  {i}. {task['task_key']}")
        print(f"     async_execution: {async_str}")
        print(f"     dependencies: {deps_str}")

    # Load team
    with open(_dir / "agents.yaml") as f:
        agents_config = yaml.safe_load(f)

    with open(_dir / "tasks.yaml") as f:
        tasks_config = yaml.safe_load(f)

    # Find leader
    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break

    if not leader_key:
        print("❌ No leader found")
        return False

    # Build agents
    print("\nBuilding agents...")
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
            verbose=False,
            llm=LLM(
                model="claude-sonnet-4-5-20250929",
                api_key=os.environ.get("ANTHROPIC_API_KEY")
            ),
            tools=agent_tools,
            allow_delegation=is_leader,
        )

        agents[key] = agent

        if is_leader:
            leader_agent = agent
        else:
            worker_agents.append(agent)

    print(f"  ✓ Created {len(agents)} agents")

    # Build tasks from plan
    print("\nBuilding tasks...")
    crew_tasks = []
    task_map = {}

    for plan_entry in delegation_plan["tasks"]:
        task_key = plan_entry["task_key"]
        async_execution = plan_entry["async_execution"]
        dependencies = plan_entry.get("dependencies", [])

        if task_key not in tasks_config:
            print(f"  ⚠️  {task_key} not in tasks.yaml, skipping")
            continue

        config = tasks_config[task_key]
        agent_key = config["agent"]

        if agent_key == leader_key:
            continue

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

        async_marker = "⚡" if async_execution else "⏸"
        print(f"  {async_marker} {task_key}")

    # Execute
    print("\nExecuting crew...")
    print("-" * 70)

    try:
        crew = Crew(
            agents=worker_agents,
            tasks=crew_tasks,
            process=Process.hierarchical,
            manager_agent=leader_agent,
            planning=False,
            verbose=True,
        )

        result = crew.kickoff()

        print("-" * 70)
        print("✅ EXECUTION SUCCESSFUL!")
        print("\nResult:")
        print(str(result)[:300] + "..." if len(str(result)) > 300 else str(result))

        return True

    except Exception as e:
        print("-" * 70)
        print(f"❌ EXECUTION FAILED!")
        print(f"Error: {str(e)}")

        # Check for specific async-related errors
        error_str = str(e).lower()
        if "async" in error_str or "validation" in error_str:
            print("\n⚠️  This appears to be an async_execution related error!")

        return False


def main():
    """Run tests with different delegation plans."""

    print("=" * 70)
    print("FIXED DELEGATION PLAN TEST")
    print("Testing if async_execution=true causes problems")
    print("=" * 70)

    # Ensure team exists
    print("\nStep 1: Ensuring team configuration exists...")
    if not ensure_team_exists():
        return False
    print("✅ Team configuration found")

    # Create test plans
    plan_with_async, plan_without_async = create_test_delegation_plans()

    # Simple test task
    test_task = "What are three benefits of exercise?"
    print(f"\nTest Task: {test_task}")

    # Test WITHOUT async first (should work)
    print("\n" + "=" * 70)
    print("CONTROL TEST: async_execution=false (should work)")
    print("=" * 70)

    control_success = test_with_delegation_plan(
        "Control (No Async)",
        plan_without_async,
        test_task
    )

    # Test WITH async (this is what we're testing)
    print("\n" + "=" * 70)
    print("EXPERIMENTAL TEST: async_execution=true (testing...)")
    print("=" * 70)

    async_success = test_with_delegation_plan(
        "Async Execution",
        plan_with_async,
        test_task
    )

    # Summary
    print("\n" + "=" * 70)
    print("TEST RESULTS SUMMARY")
    print("=" * 70)

    print(f"\nControl (async=false):     {'✅ PASSED' if control_success else '❌ FAILED'}")
    print(f"Experimental (async=true): {'✅ PASSED' if async_success else '❌ FAILED'}")

    print("\n" + "=" * 70)
    print("CONCLUSION")
    print("=" * 70)

    if control_success and async_success:
        print("✅ Both tests passed!")
        print("   async_execution=true is working correctly.")
    elif control_success and not async_success:
        print("⚠️  Control passed, but async test failed!")
        print("   🔍 FINDING: async_execution=true is causing the problem")
        print("\n   Possible causes:")
        print("   • CrewAI hierarchical mode may not support async tasks")
        print("   • Task dependency configuration issue")
        print("   • CrewAI version incompatibility")
    elif not control_success:
        print("❌ Control test failed!")
        print("   The problem is not async_execution - there's a more basic issue")

    return control_success or async_success


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
