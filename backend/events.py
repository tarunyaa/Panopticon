from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, asdict
from typing import Literal


ZoneId = Literal["HOUSE", "WORKSHOP", "CAFE", "PARK"]


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
