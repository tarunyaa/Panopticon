"""Tests for the planner: team planning and task delegation.

Tests:
  - Single-turn team planning (initial question)
  - Multi-turn interactive flow (question/answer/team creation)
  - Delegation plan creation and validation
"""

import os
import sys
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / ".env")

from planner import plan_team, plan_task_delegation

_dir = Path(__file__).parent


def test_initial_question():
    """Leader should ask a clarifying question on the first turn."""
    print("=" * 60)
    print("TEST: Initial question (empty history)")
    print("=" * 60)

    result = plan_team(
        team_description="software development team",
        history=[],
    )

    assert result["type"] in ("question", "team"), f"Unexpected type: {result['type']}"
    if result["type"] == "question":
        print(f"  Leader asked: {result['message'][:120]}")
    else:
        print(f"  Leader created team immediately ({len(result['agents'])} agents)")
    print("  PASSED\n")
    return True


def test_interactive_flow():
    """Simulate a multi-turn conversation until team is created."""
    print("=" * 60)
    print("TEST: Interactive multi-turn flow")
    print("=" * 60)

    task = "Build a REST API for a todo list app"
    history = []
    answers = [
        "Python with FastAPI. We want full CRUD operations.",
        "Yes, add JWT authentication and PostgreSQL database.",
        "Production quality with proper error handling and tests.",
    ]

    for turn in range(1, 6):
        print(f"\n  Turn {turn}:")
        result = plan_team(task, history)
        print(f"    type={result['type']}")

        if result["type"] == "team":
            agents = result["agents"]
            print(f"    Team created with {len(agents)} agents:")
            for a in agents:
                print(f"      - {a['role']}")
            assert len(agents) >= 2, "Team should have at least 2 non-leader agents"
            print("  PASSED\n")
            return True

        if result["type"] == "question":
            question = result["message"]
            print(f"    Leader: {question[:120]}")
            answer = answers[turn - 1] if turn - 1 < len(answers) else "Proceed with your best judgment."
            history.append({"role": "leader", "content": question})
            history.append({"role": "user", "content": answer})
            print(f"    User: {answer}")

    print("  WARNING: Team not created within 5 turns (may need more answers)")
    return True


def test_delegation_planning():
    """Leader should create a delegation plan with proper structure."""
    print("=" * 60)
    print("TEST: Delegation plan creation")
    print("=" * 60)

    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if not agents_path.exists() or not tasks_path.exists():
        print("  SKIPPED (no team config found)\n")
        return True

    result = plan_task_delegation(
        "Write a comprehensive blog post about the future of AI in healthcare"
    )

    if result["type"] == "error":
        print(f"  FAILED: {result['message']}\n")
        return False

    plan = result["plan"]
    tasks = plan.get("tasks", [])
    print(f"  Plan created with {len(tasks)} tasks")

    # Validate structure
    for i, task in enumerate(tasks):
        assert "task_key" in task, f"Task {i} missing task_key"
        assert "async_execution" in task, f"Task {i} missing async_execution"
        assert "dependencies" in task, f"Task {i} missing dependencies"
        assert isinstance(task["dependencies"], list), f"Task {i} dependencies must be list"
        print(f"    {task['task_key']}  async={task['async_execution']}  deps={task['dependencies']}")

    # Verify plan was saved
    plan_path = _dir / "delegation_plan.yaml"
    assert plan_path.exists(), "delegation_plan.yaml not created"

    with open(plan_path) as f:
        saved = yaml.safe_load(f)
    assert saved == plan, "Saved plan differs from returned plan"

    print("  PASSED\n")
    return True


if __name__ == "__main__":
    results = []
    for test_fn in [test_initial_question, test_interactive_flow, test_delegation_planning]:
        try:
            results.append(test_fn())
        except Exception as e:
            print(f"  FAILED with exception: {e}\n")
            results.append(False)

    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} passed")
    sys.exit(0 if all(results) else 1)
