"""Test the delegation planning workflow."""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from planner import plan_task_delegation

def test_delegation_planning():
    """Test that the Leader can create a delegation plan."""

    print("=" * 60)
    print("Testing Delegation Planning Workflow")
    print("=" * 60)

    # Test task prompt
    task_prompt = "Write a comprehensive blog post about the future of AI in healthcare"

    print(f"\nUser Task: {task_prompt}\n")
    print("Asking Leader to create delegation plan...")
    print("-" * 60)

    # Get delegation plan from Leader
    result = plan_task_delegation(task_prompt)

    if result["type"] == "error":
        print(f"\n❌ ERROR: {result['message']}")
        return False

    if result["type"] == "plan":
        plan = result["plan"]
        print("\n✅ Delegation plan created successfully!\n")
        print("=" * 60)
        print("DELEGATION PLAN")
        print("=" * 60)

        tasks = plan.get("tasks", [])
        print(f"\nTotal tasks: {len(tasks)}\n")

        # Analyze parallelism
        parallel_tasks = [t for t in tasks if t.get("async_execution") and not t.get("dependencies")]
        sequential_tasks = [t for t in tasks if not t.get("async_execution") or t.get("dependencies")]

        print("PARALLEL TASKS (will run simultaneously):")
        for task in parallel_tasks:
            print(f"  • {task['task_key']}")

        print(f"\nSEQUENTIAL TASKS (will wait for dependencies):")
        for task in sequential_tasks:
            deps = task.get("dependencies", [])
            deps_str = f" (waits for: {', '.join(deps)})" if deps else ""
            print(f"  • {task['task_key']}{deps_str}")

        print("\n" + "=" * 60)
        print("DETAILED TASK CONFIGURATION")
        print("=" * 60)

        for i, task in enumerate(tasks, 1):
            print(f"\nTask {i}: {task['task_key']}")
            print(f"  async_execution: {task.get('async_execution')}")
            print(f"  dependencies: {task.get('dependencies', [])}")

        print("\n" + "=" * 60)
        print("EXPECTED EXECUTION FLOW")
        print("=" * 60)

        print("\n1. START:")
        for task in parallel_tasks:
            print(f"   → {task['task_key']} starts immediately")

        print("\n2. WAIT for parallel tasks to complete...")

        print("\n3. THEN:")
        for task in sequential_tasks:
            deps = task.get("dependencies", [])
            if deps:
                print(f"   → {task['task_key']} starts (has outputs from {', '.join(deps)})")
            else:
                print(f"   → {task['task_key']} starts")

        print("\n4. DONE - All tasks complete")
        print("\n" + "=" * 60)

        return True

    print(f"\n❌ Unexpected result type: {result['type']}")
    return False


if __name__ == "__main__":
    try:
        success = test_delegation_planning()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
