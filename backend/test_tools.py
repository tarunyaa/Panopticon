"""Tests for tools and basic imports.

Tests:
  - All backend modules import cleanly
  - Terminal tool security (allowlist enforcement)
  - Tool registry availability
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / ".env")


def test_imports():
    """All backend modules should import without errors."""
    print("=" * 60)
    print("TEST: Module imports")
    print("=" * 60)

    modules = [
        ("events", "from events import event_bus, EventBus"),
        ("tools", "from tools import get_available_tools, terminal"),
        ("planner", "from planner import plan_team, plan_task_delegation"),
        ("graph", "from graph import run_graph"),
        ("gate_policy", "from gate_policy import should_gate_task_complete"),
        ("activity_callbacks", "from activity_callbacks import ActivityTracker"),
    ]

    all_ok = True
    for name, import_str in modules:
        try:
            exec(import_str)
            print(f"  OK  {name}")
        except Exception as e:
            print(f"  FAIL {name}: {e}")
            all_ok = False

    status = "PASSED" if all_ok else "FAILED"
    print(f"  {status}\n")
    return all_ok


def test_terminal_allowlist():
    """Terminal tool should block disallowed commands."""
    print("=" * 60)
    print("TEST: Terminal tool security")
    print("=" * 60)

    from tools import terminal

    # Allowed commands should work
    result = terminal.invoke({"command": "echo hello"})
    assert "hello" in result, f"echo should work, got: {result}"
    print("  OK  'echo hello' allowed")

    # Disallowed base commands should be blocked
    result = terminal.invoke({"command": "rm -rf /"})
    assert "Error" in result, f"rm should be blocked, got: {result}"
    print("  OK  'rm -rf /' blocked")

    # Path-based bypass attempts should be blocked
    result = terminal.invoke({"command": "/bin/rm file.txt"})
    assert "Error" in result, f"/bin/rm should be blocked, got: {result}"
    print("  OK  '/bin/rm' blocked")

    # Blocked subcommands
    result = terminal.invoke({"command": "git push origin main"})
    assert "Error" in result, f"git push should be blocked, got: {result}"
    print("  OK  'git push' blocked")

    result = terminal.invoke({"command": "pip install malware"})
    assert "Error" in result, f"pip install should be blocked, got: {result}"
    print("  OK  'pip install' blocked")

    print("  PASSED\n")
    return True


def test_tool_registry():
    """Tool registry should list available tools."""
    print("=" * 60)
    print("TEST: Tool registry")
    print("=" * 60)

    from tools import get_available_tools, TOOL_REGISTRY

    tools = get_available_tools()
    assert len(tools) >= 4, f"Expected at least 4 tools, got {len(tools)}"

    expected_ids = {"web_search", "web_scraper", "terminal", "file_writer"}
    actual_ids = {t["id"] for t in tools}
    assert expected_ids.issubset(actual_ids), f"Missing tools: {expected_ids - actual_ids}"

    for t in tools:
        print(f"  {t['id']}: available={t['available']}")

    print("  PASSED\n")
    return True


if __name__ == "__main__":
    results = []
    for test_fn in [test_imports, test_terminal_allowlist, test_tool_registry]:
        try:
            results.append(test_fn())
        except Exception as e:
            print(f"  FAILED with exception: {e}\n")
            import traceback
            traceback.print_exc()
            results.append(False)

    print("=" * 60)
    passed = sum(results)
    print(f"Results: {passed}/{len(results)} passed")
    sys.exit(0 if all(results) else 1)
