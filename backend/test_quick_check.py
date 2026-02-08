"""
Quick check to verify basic delegation planning is working.

This is a fast test that doesn't run the full crew, just checks:
1. Can we create a delegation plan?
2. Are tasks properly configured?
3. Is parallelization set up correctly?
"""

import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / "panopticon" / ".env")

from planner import plan_task_delegation

_dir = Path(__file__).parent


def quick_check():
    """Quick functionality check."""

    print("=" * 60)
    print("QUICK FUNCTIONALITY CHECK")
    print("=" * 60)

    # Check 1: Team exists
    print("\n✓ Check 1: Team Configuration")
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if not agents_path.exists():
        print("   ❌ agents.yaml not found")
        return False
    if not tasks_path.exists():
        print("   ❌ tasks.yaml not found")
        return False

    with open(agents_path) as f:
        agents = yaml.safe_load(f)
    with open(tasks_path) as f:
        tasks = yaml.safe_load(f)

    print(f"   ✅ Found {len(agents)} agents, {len(tasks)} task templates")

    # Check 2: Delegation planning
    print("\n✓ Check 2: Delegation Planning")
    test_task = "Write a short article about AI with research and strategy"

    print(f"   Task: {test_task}")
    print("   Calling plan_task_delegation()...")

    result = plan_task_delegation(test_task)

    if result["type"] == "error":
        print(f"   ❌ Planning failed: {result['message']}")
        return False

    plan = result["plan"]
    planned_tasks = plan.get("tasks", [])

    print(f"   ✅ Plan created with {len(planned_tasks)} tasks")

    # Check 3: Parallelization
    print("\n✓ Check 3: Parallelization Configuration")

    parallel = [t for t in planned_tasks if t.get("async_execution") and not t.get("dependencies")]
    sequential = [t for t in planned_tasks if not t.get("async_execution") or t.get("dependencies")]

    print(f"   Parallel tasks: {len(parallel)}")
    for t in parallel:
        print(f"      ⚡ {t['task_key']}")

    print(f"   Sequential tasks: {len(sequential)}")
    for t in sequential:
        deps = t.get("dependencies", [])
        print(f"      ⏸  {t['task_key']}" + (f" (waits for: {', '.join(deps)})" if deps else ""))

    if len(parallel) < 2:
        print("   ⚠️  Less than 2 parallel tasks (may be intentional)")

    # Check 4: Task structure
    print("\n✓ Check 4: Task Structure Validation")

    all_valid = True
    for i, task in enumerate(planned_tasks, 1):
        task_key = task.get("task_key")
        has_async = "async_execution" in task
        has_deps = "dependencies" in task

        if not task_key:
            print(f"   ❌ Task {i}: Missing task_key")
            all_valid = False
        elif not has_async:
            print(f"   ❌ Task {i} ({task_key}): Missing async_execution")
            all_valid = False
        elif not has_deps:
            print(f"   ❌ Task {i} ({task_key}): Missing dependencies")
            all_valid = False

    if all_valid:
        print("   ✅ All tasks have required fields")

    # Check 5: Delegation plan file
    print("\n✓ Check 5: Delegation Plan File")
    plan_path = _dir / "delegation_plan.yaml"

    if not plan_path.exists():
        print("   ❌ delegation_plan.yaml not created")
        return False

    with open(plan_path) as f:
        saved_plan = yaml.safe_load(f)

    if saved_plan == plan:
        print("   ✅ Plan saved correctly to delegation_plan.yaml")
    else:
        print("   ⚠️  Saved plan differs from returned plan")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    checks = {
        "Team configuration": agents_path.exists() and tasks_path.exists(),
        "Delegation planning": result["type"] == "plan",
        "Task structure": all_valid,
        "Plan file saved": plan_path.exists(),
    }

    all_passed = all(checks.values())

    for check, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"{status} {check}")

    if all_passed:
        print("\n🎉 All checks passed! Basic functionality working.")
        print("\nNext step: Run 'python test_basic_functionality.py' for full execution test")
    else:
        print("\n⚠️  Some checks failed. Review output above.")

    return all_passed


if __name__ == "__main__":
    try:
        success = quick_check()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
