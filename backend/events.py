from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ZoneId = Literal["HOUSE", "WORKSHOP", "CAFE", "PARK", "DORM"]
GatingMode = Literal["STRICT", "BALANCED", "AUTO"]


@dataclass
class RunStartedEvent:
    type: str = "RUN_STARTED"
    runId: str = ""
    prompt: str = ""


@dataclass
class AgentIntentEvent:
    type: str = "AGENT_INTENT"
    agentName: str = ""
    zone: ZoneId = "PARK"
    message: str = ""


@dataclass
class AgentOutputEvent:
    type: str = "AGENT_OUTPUT"
    agentName: str = ""
    output: str = ""


@dataclass
class RunFinishedEvent:
    type: str = "RUN_FINISHED"
    runId: str = ""


@dataclass
class TaskSummaryEvent:
    type: str = "TASK_SUMMARY"
    agentName: str = ""
    summary: str = ""
    fullOutput: str = ""


@dataclass
class ErrorEvent:
    type: str = "ERROR"
    message: str = ""


@dataclass
class GateRequestedEvent:
    type: str = "GATE_REQUESTED"
    gateId: str = ""
    runId: str = ""
    agentName: str = ""
    question: str = ""
    context: str = ""
    reason: str = ""
    gateSource: str = "task_complete"


@dataclass
class GateRecommendedEvent:
    """Leader's advisory gate recommendation (does not block execution)."""
    type: str = "GATE_RECOMMENDED"
    agentName: str = ""
    reason: str = ""
    context: str = ""
    question: str = ""
    options: str = ""
    recommendation: str = ""


@dataclass
class AgentActivityEvent:
    type: str = "AGENT_ACTIVITY"
    agentName: str = ""
    activity: str = "idle"  # "idle" | "tool_call" | "llm_generating"
    details: str = ""


@dataclass
class TaskHandoffEvent:
    type: str = "TASK_HANDOFF"
    receivingAgent: str = ""
    sourceAgents: list = None
    summary: str = ""

    def __post_init__(self):
        if self.sourceAgents is None:
            self.sourceAgents = []


@dataclass
class GateResponse:
    action: str = "approve"   # "approve" | "reject"
    note: str = ""
