"""
Simple test to demonstrate 2 agents configured to work in parallel.

This test shows ONLY the delegation planning phase where the Leader
decides which tasks should run in parallel.
"""

import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from planner import plan_task_delegation

_dir = Path(__file__).parent


def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(title.center(70))
    print("=" * 70 + "\n")


def print_task_config(task, index, total):
    """Print task configuration in a readable format."""
    task_key = task["task_key"]
    async_exec = task.get("async_execution", False)
    dependencies = task.get("dependencies", [])

    print(f"\nTask {index}/{total}: {task_key}")
    print("─" * 50)

    if async_exec and not dependencies:
        print("  🟢 Status: PARALLEL")
        print("  ⚡ Execution: Starts immediately")
        print("  🔗 Dependencies: None")
        print("  ➡️  Will run concurrently with other parallel tasks")
    elif dependencies:
        print("  🟡 Status: SEQUENTIAL")
        print("  ⏸  Execution: Waits for dependencies")
        print(f"  🔗 Dependencies: {', '.join(dependencies)}")
        print(f"  ➡️  Will start after {' and '.join(dependencies)} complete")
    else:
        print("  🟡 Status: SEQUENTIAL")
        print("  ⏸  Execution: Runs in sequence")
        print("  🔗 Dependencies: None")

    print(f"  📝 async_execution: {async_exec}")
    print(f"  📝 dependencies: {dependencies}")


def visualize_execution_flow(tasks):
    """Create a visual representation of task execution flow."""
    print_header("EXECUTION FLOW VISUALIZATION")

    parallel_tasks = [t for t in tasks if t.get("async_execution") and not t.get("dependencies")]
    sequential_tasks = [t for t in tasks if not t.get("async_execution") or t.get("dependencies")]

    print("START")
    print("  │")

    if parallel_tasks:
        print("  ├─ 🔀 PARALLEL EXECUTION (simultaneous)")
        for task in parallel_tasks:
            print(f"  │   ├─⚡ {task['task_key']}")
        print("  │   │")
        print("  │   └─⏱️  Both agents work at the same time!")
        print("  │")
        print("  ├─ ⏳ WAIT for all parallel tasks to complete...")
        print("  │")

    if sequential_tasks:
        for task in sequential_tasks:
            deps = task.get("dependencies", [])
            if deps:
                print(f"  ├─ ✅ {', '.join(deps)} completed")
                print("  │")
            print(f"  ├─ ▶️  {task['task_key']} starts")
            print("  │   └─ (has context from previous tasks)")
            print("  │")

    print("  └─ ✅ DONE")


def test_simple_parallel():
    """Test parallel task configuration with a clear example."""

    print_header("PARALLEL TASK DELEGATION TEST")

    # Check if team exists
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if not agents_path.exists() or not tasks_path.exists():
        print("❌ Team not found!")
        print("Please create a team first (agents.yaml and tasks.yaml)")
        return False

    # Show available team
    with open(agents_path) as f:
        agents = yaml.safe_load(f)

    print("Available Team Members:")
    for agent_key, agent_data in agents.items():
        role = agent_data.get("role", "")
        if "leader" not in role.lower():
            print(f"  🤖 {agent_key}: {role}")

    # Task that should trigger parallel execution
    task_prompt = "Write an article about quantum computing. Include both technical research and a strategic outline for the content structure."

    print(f"\n📝 User Task:")
    print(f"   \"{task_prompt}\"")

    print("\n⏳ Asking Leader to create delegation plan...")

    # Get delegation plan
    result = plan_task_delegation(task_prompt)

    if result["type"] == "error":
        print(f"\n❌ Error: {result['message']}")
        return False

    plan = result["plan"]
    tasks = plan.get("tasks", [])

    print("\n✅ Delegation plan received!")

    # Analyze the plan
    print_header("DELEGATION PLAN ANALYSIS")

    print(f"Total tasks to execute: {len(tasks)}")

    parallel_count = sum(1 for t in tasks if t.get("async_execution") and not t.get("dependencies"))
    sequential_count = len(tasks) - parallel_count

    print(f"  🟢 Parallel tasks: {parallel_count}")
    print(f"  🟡 Sequential tasks: {sequential_count}")

    # Show each task configuration
    print_header("TASK CONFIGURATIONS")

    for i, task in enumerate(tasks, 1):
        print_task_config(task, i, len(tasks))

    # Visualize execution flow
    visualize_execution_flow(tasks)

    # Summary
    print_header("SUMMARY")

    if parallel_count >= 2:
        print("✅ SUCCESS: Leader configured 2+ agents to work in PARALLEL!")
        print("\nWhat this means:")
        print("  • Multiple agents will start working at the same time")
        print("  • They will execute concurrently (not waiting for each other)")
        print("  • The final task waits for all parallel tasks to complete")
        print("  • This maximizes speed and minimizes total execution time")
        print("\n💡 Expected speedup:")
        print(f"  Sequential: Task1 → Task2 → Task3 (slowest)")
        print(f"  Parallel:   Task1 + Task2 → Task3 (faster!)")
    else:
        print("ℹ️  INFO: Leader decided sequential execution is better for this task")
        print("\nPossible reasons:")
        print("  • Tasks have dependencies (one needs the other's output)")
        print("  • Task is simple and doesn't benefit from parallelization")
        print("  • Only one agent is needed")

    # Show the raw YAML for reference
    print_header("RAW DELEGATION PLAN (YAML)")
    print(yaml.dump(plan, sort_keys=False, default_flow_style=False))

    return True


if __name__ == "__main__":
    try:
        success = test_simple_parallel()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
