"""Gate policy engine for human-in-the-loop approval."""

from __future__ import annotations
from typing import Literal, Optional


GatingMode = Literal["STRICT", "BALANCED", "AUTO"]


def should_gate_task_complete(
    mode: GatingMode,
    is_last_task: bool,
    leader_recommended: bool = False,
) -> tuple[bool, str]:
    """Decide if we should gate after a task completes.

    Returns: (should_gate, reason)
    """
    # STRICT: Gate after every task (except we skip gates on last task since run is done)
    if mode == "STRICT":
        if is_last_task:
            return (False, "")
        return (True, "STRICT mode requires approval after every task")

    # BALANCED: Gate on final deliverable OR leader request
    if mode == "BALANCED":
        if is_last_task:
            return (True, "Final deliverable ready for review")
        if leader_recommended:
            return (True, "Leader requested approval")
        return (False, "")

    # AUTO: Only gate on leader request
    if mode == "AUTO":
        if is_last_task:
            return (True, "Final deliverable ready for review")
        if leader_recommended:
            return (True, "Leader requested approval for critical decision")
        return (False, "")

    return (False, "")


def should_gate_tool_call(
    mode: GatingMode,
    tool_name: str,
    leader_recommended: bool = False,
) -> tuple[bool, str]:
    """Decide if we should gate before a tool executes.

    Hard rules (all modes): Always gate on file/terminal operations.

    Returns: (should_gate, reason)
    """
    # Hard rules: Always gate on destructive operations
    if tool_name == "file_writer":
        return (True, "File operation requires approval (create/modify/delete)")

    if tool_name == "terminal":
        return (True, "Terminal command requires approval")

    # No other tool-based gating for now
    return (False, "")
