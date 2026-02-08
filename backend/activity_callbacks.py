"""LangChain callback handler for tracking agent activity (tool calls, LLM generation)."""

from typing import Any, Dict, List, Optional
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

try:
    from .events import AgentActivityEvent, event_bus
except ImportError:
    from events import AgentActivityEvent, event_bus


class ActivityTracker(BaseCallbackHandler):
    """Tracks agent activity and emits events for tool calls and LLM generation."""

    def __init__(self, run_id: str, agent_name: str):
        super().__init__()
        self.run_id = run_id
        self.agent_name = agent_name

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Called when LLM generation starts."""
        event_bus.emit(
            self.run_id,
            AgentActivityEvent(
                agentName=self.agent_name,
                activity="llm_generating",
                details="Thinking...",
            ),
        )

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Called when LLM generation ends."""
        event_bus.emit(
            self.run_id,
            AgentActivityEvent(
                agentName=self.agent_name,
                activity="idle",
                details="",
            ),
        )

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Called when tool execution starts."""
        tool_name = serialized.get("name", "unknown_tool")
        event_bus.emit(
            self.run_id,
            AgentActivityEvent(
                agentName=self.agent_name,
                activity="tool_call",
                details=f"Using {tool_name}",
            ),
        )

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> None:
        """Called when tool execution ends."""
        event_bus.emit(
            self.run_id,
            AgentActivityEvent(
                agentName=self.agent_name,
                activity="idle",
                details="",
            ),
        )

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> None:
        """Called when tool execution encounters an error."""
        event_bus.emit(
            self.run_id,
            AgentActivityEvent(
                agentName=self.agent_name,
                activity="idle",
                details="",
            ),
        )
