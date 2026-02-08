from __future__ import annotations

import asyncio
import json
import threading
import uuid
from dataclasses import dataclass, asdict
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
    reason: str = ""  # Why this gate is needed
    gateSource: str = "task_complete"  # "task_complete" | "file_operation" | "terminal_command" | "leader_request"


@dataclass
class GateRecommendedEvent:
    """Leader's advisory gate recommendation (does not block execution)."""
    type: str = "GATE_RECOMMENDED"
    agentName: str = ""
    reason: str = ""
    context: str = ""
    question: str = ""
    options: str = ""  # JSON-encoded list of options
    recommendation: str = ""


@dataclass
class AgentActivityEvent:
    type: str = "AGENT_ACTIVITY"
    agentName: str = ""
    activity: str = "idle"  # "idle" | "tool_call" | "llm_generating"
    details: str = ""  # tool name or current task description


@dataclass
class TaskHandoffEvent:
    type: str = "TASK_HANDOFF"
    receivingAgent: str = ""
    sourceAgents: list = None  # List of agent names whose outputs are being used
    summary: str = ""  # Brief description of what's being handed off

    def __post_init__(self):
        if self.sourceAgents is None:
            self.sourceAgents = []


@dataclass
class GateResponse:
    action: str = "approve"   # "approve" | "reject"
    note: str = ""


class GateStore:
    """Thread-safe store for human-in-the-loop gates."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # run_id -> gate_id -> (Event, GateResponse | None)
        self._gates: dict[str, dict[str, tuple[threading.Event, GateResponse | None]]] = {}

    def create_gate(self, run_id: str) -> tuple[str, threading.Event]:
        gate_id = str(uuid.uuid4())
        event = threading.Event()
        with self._lock:
            self._gates.setdefault(run_id, {})[gate_id] = (event, None)
        return gate_id, event

    def resolve_gate(self, run_id: str, gate_id: str, response: GateResponse) -> bool:
        with self._lock:
            run_gates = self._gates.get(run_id, {})
            entry = run_gates.get(gate_id)
            if entry is None:
                return False
            event, _ = entry
            run_gates[gate_id] = (event, response)
        event.set()
        return True

    def get_response(self, run_id: str, gate_id: str) -> GateResponse | None:
        with self._lock:
            run_gates = self._gates.get(run_id, {})
            entry = run_gates.get(gate_id)
            if entry is None:
                return None
            return entry[1]

    def cleanup(self, run_id: str) -> None:
        with self._lock:
            gates = self._gates.pop(run_id, {})
        # Unblock any stuck threads
        for event, _ in gates.values():
            event.set()


gate_store = GateStore()


class EventBus:
    """Async event queue for streaming events to WebSocket clients."""

    def __init__(self) -> None:
        self.queues: dict[str, asyncio.Queue] = {}

    def create_run(self, run_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.queues[run_id] = q
        return q

    def get_queue(self, run_id: str) -> asyncio.Queue | None:
        return self.queues.get(run_id)

    def emit(self, run_id: str, event) -> None:
        q = self.queues.get(run_id)
        if q is not None:
            q.put_nowait(json.dumps(asdict(event)))

    def cleanup(self, run_id: str) -> None:
        self.queues.pop(run_id, None)


event_bus = EventBus()
