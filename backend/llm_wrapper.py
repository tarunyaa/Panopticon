"""Custom LLM wrapper that fixes malformed message histories before sending to Anthropic.

This solves the CrewAI 1.9.3 bug where async_execution + hierarchical delegation
creates tool_use blocks without corresponding tool_result blocks, causing 400 errors.
"""

from __future__ import annotations

import os
from typing import Any, Optional
from crewai import LLM
from anthropic import Anthropic


class AnthropicMessageFixer(LLM):
    """LLM wrapper that ensures all tool_use blocks have corresponding tool_result blocks.

    When CrewAI's hierarchical delegation runs with async_execution=True, it sometimes
    drops tool_result messages from the history, causing Anthropic to reject the request
    with a 400 error. This wrapper detects and fixes those cases by injecting synthetic
    tool_result blocks.
    """

    def __init__(self, model: str, api_key: Optional[str] = None, **kwargs):
        # Get API key from environment if not provided
        if api_key is None:
            api_key = os.environ.get("ANTHROPIC_API_KEY")

        super().__init__(model=model, api_key=api_key, **kwargs)
        self._anthropic_client = Anthropic(api_key=api_key)

    def _fix_message_history(self, messages: list[dict]) -> list[dict]:
        """Scan messages and inject tool_result blocks for any orphaned tool_use blocks.

        Args:
            messages: List of message dicts with 'role' and 'content' keys

        Returns:
            Fixed message list with synthetic tool_result blocks inserted
        """
        if not messages:
            return messages

        fixed = []
        pending_tool_uses = {}  # tool_id -> tool_use_block

        for msg in messages:
            fixed.append(msg)

            # Skip non-assistant/user messages
            if msg.get("role") not in ("assistant", "user"):
                continue

            content = msg.get("content", [])

            # Handle string content (convert to list format)
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]

            for block in content:
                block_type = block.get("type")

                if block_type == "tool_use":
                    # Track this tool_use by ID
                    tool_id = block.get("id")
                    if tool_id:
                        pending_tool_uses[tool_id] = block

                elif block_type == "tool_result":
                    # This tool_use has a result - remove from pending
                    tool_id = block.get("tool_use_id")
                    pending_tool_uses.pop(tool_id, None)

        # If we have orphaned tool_use blocks, inject synthetic tool_result messages
        if pending_tool_uses:
            # Find the position to insert results (right after the last assistant message with tool_use)
            insert_position = len(fixed)

            for i in range(len(fixed) - 1, -1, -1):
                msg = fixed[i]
                if msg.get("role") == "assistant":
                    content = msg.get("content", [])
                    if isinstance(content, str):
                        content = [{"type": "text", "text": content}]

                    # Check if this message has any of the pending tool_uses
                    has_pending_tool = any(
                        block.get("type") == "tool_use" and block.get("id") in pending_tool_uses
                        for block in content
                    )

                    if has_pending_tool:
                        insert_position = i + 1
                        break

            # Create synthetic tool_result blocks for each orphaned tool_use
            synthetic_results = []
            for tool_id, tool_use_block in pending_tool_uses.items():
                tool_name = tool_use_block.get("name", "unknown_tool")
                synthetic_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": f"[Delegation completed - result propagated to manager context]"
                })

            # Insert a user message containing the synthetic tool_results
            if synthetic_results:
                fixed.insert(insert_position, {
                    "role": "user",
                    "content": synthetic_results
                })

        return fixed

    def call(
        self,
        messages,
        tools=None,
        callbacks=None,
        available_functions=None,
        from_task=None,
        from_agent=None,
        response_model=None,
    ) -> Any:
        """Override the call method to fix messages before sending to Anthropic."""
        print(f"\n🔧 AnthropicMessageFixer.call() invoked with {len(messages) if isinstance(messages, list) else 1} messages")

        # Convert messages to list format if needed
        if isinstance(messages, str):
            msg_list = [{"role": "user", "content": messages}]
        elif isinstance(messages, list):
            # Convert LLMMessage objects to dicts if needed
            msg_list = []
            for msg in messages:
                if hasattr(msg, 'to_dict'):
                    msg_list.append(msg.to_dict())
                elif isinstance(msg, dict):
                    msg_list.append(msg)
                else:
                    msg_list.append({"role": "user", "content": str(msg)})
        else:
            msg_list = [{"role": "user", "content": str(messages)}]

        print(f"📝 Converted to {len(msg_list)} message dicts")

        # Fix the message history
        fixed_messages = self._fix_message_history(msg_list)

        if len(fixed_messages) != len(msg_list):
            print(f"✅ Fixed message history: {len(msg_list)} -> {len(fixed_messages)} messages")

        # Use the parent class's call method with fixed messages
        return super().call(
            fixed_messages,
            tools=tools,
            callbacks=callbacks,
            available_functions=available_functions,
            from_task=from_task,
            from_agent=from_agent,
            response_model=response_model,
        )
