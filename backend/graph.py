"""LangGraph-based agent orchestration engine.

Builds a dynamic StateGraph from the delegation plan and runs worker agents
via create_react_agent. Parallel fan-out / fan-in is handled natively by
LangGraph's edge semantics. Events are streamed via astream_events(v2).
"""
from __future__ import annotations

import operator
import os
import re
import uuid
import yaml
from typing import Any, Annotated
from typing_extensions import TypedDict

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import MemorySaver

try:
    from .tools import instantiate_tools
    from .gate_policy import should_gate_task_complete
    from .events import GatingMode
except ImportError:
    from tools import instantiate_tools
    from gate_policy import should_gate_task_complete
    from events import GatingMode

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_dir = os.path.dirname(os.path.abspath(__file__))

_MODEL = "claude-sonnet-4-5-20250929"


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class TaskOutput(TypedDict):
    task_key: str
    agent_name: str
    output: str


class PanopticonState(TypedDict):
    prompt: str
    run_id: str
    gating_mode: str
    task_outputs: Annotated[list[TaskOutput], operator.add]
    total_tasks: int
    final_output: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _estimate_max_tokens(description: str, expected_output: str) -> int:
    """Classify task complexity by keywords and return an appropriate max_tokens."""
    text = (description + " " + expected_output).lower()
    long_keywords = ("code", "implementation", "implement", "full document", "research paper", "write code", "develop")
    short_keywords = ("rubric", "outline", "summary", "list", "review", "feedback", "plan", "checklist", "brief")
    for kw in long_keywords:
        if kw in text:
            return 4096
    for kw in short_keywords:
        if kw in text:
            return 1024
    # Default: medium
    return 2048


def _summarize_output(text: str, limit: int = 160) -> str:
    """Produce a clean one-liner summary from agent output."""
    text = re.sub(r"^#+\s*", "", text)
    text = re.sub(r"\n#+\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    for delim in (". ", ".\n"):
        idx = text.find(delim)
        if 0 < idx < limit:
            return text[: idx + 1]
    if len(text) > limit:
        return text[:limit] + "..."
    return text


# ---------------------------------------------------------------------------
# Worker node factory
# ---------------------------------------------------------------------------

def make_worker_node(
    task_key: str,
    agent_key: str,
    agent_config: dict,
    task_config: dict,
    deps: list[str],
    task_agent_map: dict[str, str],
    mode: GatingMode,
    task_index: int,
    total_tasks: int,
):
    """Return an async closure that runs a single worker agent inside the StateGraph."""

    agent_name = agent_key.replace("_", " ").title()

    async def worker_node(state: PanopticonState) -> dict[str, Any]:
        run_id = state["run_id"]
        prompt = state["prompt"]

        # Build tools and LLM
        agent_tools = instantiate_tools(agent_config.get("tools", []))

        max_tokens = _estimate_max_tokens(
            task_config.get("description", ""),
            task_config.get("expected_output", ""),
        )
        llm = ChatAnthropic(
            model=_MODEL,
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            max_tokens=max_tokens,
        )

        # System prompt — only mention tools the agent actually has
        agent_tool_ids = set(agent_config.get("tools", []))

        workspace_lines = ""
        if "file_reader" in agent_tool_ids or "list_input_files" in agent_tool_ids:
            workspace_lines += "- Use list_input_files and file_reader to read any reference materials the user placed in the input folder.\n"
        if "file_writer" in agent_tool_ids:
            workspace_lines += "- Use file_writer to save deliverables (reports, code, data) to the output folder.\n"

        tool_rule_lines = ""
        if "web_search" in agent_tool_ids:
            tool_rule_lines += "- web_search is for quick fact lookups (recent stats, prices, current events) — not general knowledge.\n"
        if "web_scraper" in agent_tool_ids:
            tool_rule_lines += "- web_scraper is only for reading a specific URL you already have — never scrape speculatively.\n"

        system_msg = (
            f"You are {agent_name}.\n"
            f"Role: {agent_config['role'].strip()}\n"
            f"Goal: {agent_config['goal'].strip()}\n"
            f"Backstory: {agent_config['backstory'].strip()}\n\n"
            f"Complete the task described below. Be thorough and produce high-quality output.\n"
            f"When you are done, provide your final answer directly — do not use any special markers.\n\n"
        )

        if workspace_lines:
            system_msg += f"WORKSPACE:\n{workspace_lines}\n"

        if agent_tool_ids:
            system_msg += (
                f"TOOL USE RULES:\n"
                f"- Only use tools when you NEED external information you do not already know.\n"
                f"- Do NOT search for things you can answer from your own knowledge.\n"
                f"{tool_rule_lines}"
                f"- Prefer producing your answer directly over unnecessary tool calls.\n\n"
            )

        system_msg += (
            f"OUTPUT LENGTH:\n"
            f"- Be concise — match your output length to the complexity of the task.\n"
            f"- Short tasks (outlines, lists, reviews) need short answers. Only elaborate for complex deliverables."
        )

        # Build task description
        desc = task_config["description"].strip()
        if "{prompt}" in desc:
            desc = desc.replace("{prompt}", prompt)
        else:
            desc += f"\n\nUser's request: {prompt}"

        # Append context from dependencies
        context_parts = []
        task_outputs = state.get("task_outputs", [])
        for dep_key in deps:
            for to in task_outputs:
                if to["task_key"] == dep_key:
                    dep_agent = task_agent_map.get(dep_key, dep_key)
                    context_parts.append(f"--- Output from {dep_agent} ---\n{to['output']}")
                    break

        if context_parts:
            desc += "\n\n## Context from previous agents\n\n" + "\n\n".join(context_parts)

        expected = task_config.get("expected_output", "").strip()
        if expected:
            desc += f"\n\n## Expected Output\n{expected}"

        # Run the react agent — handles the full tool-calling loop
        react_agent = create_react_agent(
            model=llm,
            tools=agent_tools,
            prompt=system_msg,
        )

        result = await react_agent.ainvoke(
            {"messages": [HumanMessage(content=desc)]},
            config={"tags": [f"worker:{task_key}"]},
        )

        # Extract final output from last AI message
        # Claude may return content as a list of blocks (e.g. [{"type":"text","text":"..."}])
        # rather than a plain string, so handle both formats.
        final_output = ""
        for msg in reversed(result["messages"]):
            if getattr(msg, "type", None) != "ai":
                continue
            content = msg.content
            if isinstance(content, str) and content.strip():
                final_output = content
                break
            elif isinstance(content, list):
                text_parts = [
                    block["text"] for block in content
                    if isinstance(block, dict) and block.get("type") == "text" and block.get("text", "").strip()
                ]
                if text_parts:
                    final_output = "\n".join(text_parts)
                    break
        if not final_output:
            final_output = "(no output)"

        # Gate logic
        is_last = task_index == total_tasks - 1
        should_gate, reason = should_gate_task_complete(
            mode=mode,
            is_last_task=is_last,
            leader_recommended=False,
        )

        if should_gate:
            gate_id = str(uuid.uuid4())

            question = f"{agent_name} finished their task. Continue?"
            if is_last:
                question = "Final deliverable ready. Approve?"

            # interrupt() suspends the graph — the WebSocket handler will
            # read this payload from state.tasks[*].interrupts[*].value
            # and send a GATE_REQUESTED event to the frontend.
            decision = interrupt({
                "gate_id": gate_id,
                "run_id": run_id,
                "agent_name": agent_name,
                "question": question,
                "context": final_output,
                "reason": reason,
                "gate_source": "task_complete",
            })

            # When resumed, `decision` is whatever Command(resume=...) passed.
            if isinstance(decision, dict) and decision.get("action") == "reject":
                raise RuntimeError(f"Run rejected by user at {agent_name}'s gate")

            # Append human feedback to output so downstream tasks see it
            note = decision.get("note", "") if isinstance(decision, dict) else ""
            if note:
                final_output += f"\n\n[Human feedback]: {note}"

        return {"task_outputs": [{"task_key": task_key, "agent_name": agent_name, "output": final_output}]}

    return worker_node


# ---------------------------------------------------------------------------
# Synthesize node
# ---------------------------------------------------------------------------

async def synthesize_node(state: PanopticonState) -> dict[str, Any]:
    """Combine all task outputs into a single final deliverable."""
    task_outputs = state.get("task_outputs", [])
    prompt = state["prompt"]

    if len(task_outputs) <= 1:
        # Single task — just pass the output through
        final = task_outputs[0]["output"] if task_outputs else "(no output)"
        return {"final_output": final}

    # Multiple tasks — synthesize via LLM
    llm = ChatAnthropic(
        model=_MODEL,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        max_tokens=4096,
    )

    all_outputs = "\n\n".join(
        f"## {to['agent_name']}\n{to['output']}"
        for to in task_outputs
    )

    synthesis_msg = await llm.ainvoke([
        SystemMessage(content=(
            "You are a team leader synthesizing outputs from your team members. "
            "Combine the following agent outputs into a single, cohesive final deliverable. "
            "Maintain the depth and detail of each contribution while creating a unified document."
        )),
        HumanMessage(content=(
            f"Original request: {prompt}\n\n"
            f"## Agent Outputs\n\n{all_outputs}\n\n"
            f"Synthesize these into a complete, polished final deliverable."
        )),
    ])

    final = synthesis_msg.content if isinstance(synthesis_msg.content, str) else str(synthesis_msg.content)
    return {"final_output": final}


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_execution_graph(
    delegation_plan: dict,
    agents_config: dict,
    tasks_config: dict,
    gating_mode: GatingMode,
) -> tuple[Any, dict[str, dict]]:
    """Build and compile a StateGraph from the delegation plan.

    Returns:
        (compiled_graph, node_meta) where node_meta maps task_key to
        {"agent_name": ..., "role": ..., "deps": [...], "dep_agents": [...]}.
    """
    planned_tasks = delegation_plan.get("tasks", [])

    # Identify the Leader agent (skip from execution)
    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break

    # Filter out leader tasks
    exec_tasks = [
        t for t in planned_tasks
        if t["task_key"] in tasks_config
        and tasks_config[t["task_key"]].get("agent") != leader_key
    ]

    if not exec_tasks:
        raise ValueError("No executable tasks after filtering leader tasks")

    # Build task -> agent name mapping
    task_agent_map: dict[str, str] = {}
    for t in exec_tasks:
        agent_key = tasks_config[t["task_key"]]["agent"]
        task_agent_map[t["task_key"]] = agent_key.replace("_", " ").title()

    total_tasks = len(exec_tasks)
    task_keys = {t["task_key"] for t in exec_tasks}
    depended_on: set[str] = set()

    builder = StateGraph(PanopticonState)

    # Build node_meta for translate_event
    node_meta: dict[str, dict] = {}

    for i, plan_entry in enumerate(exec_tasks):
        task_key = plan_entry["task_key"]
        task_cfg = tasks_config[task_key]
        agent_key = task_cfg["agent"]
        agent_cfg = agents_config[agent_key]
        entry_deps = [d for d in plan_entry.get("dependencies", []) if d in task_keys]

        agent_name = agent_key.replace("_", " ").title()
        dep_agents = [task_agent_map[d] for d in entry_deps if d in task_agent_map]

        node_meta[task_key] = {
            "agent_name": agent_name,
            "role": agent_cfg.get("role", ""),
            "deps": entry_deps,
            "dep_agents": dep_agents,
        }

        worker_fn = make_worker_node(
            task_key=task_key,
            agent_key=agent_key,
            agent_config=agent_cfg,
            task_config=task_cfg,
            deps=entry_deps,
            task_agent_map=task_agent_map,
            mode=gating_mode,
            task_index=i,
            total_tasks=total_tasks,
        )
        builder.add_node(task_key, worker_fn)

        if not entry_deps:
            builder.add_edge(START, task_key)
        else:
            for dep_key in entry_deps:
                builder.add_edge(dep_key, task_key)
                depended_on.add(dep_key)

    # Add synthesize node
    builder.add_node("synthesize", synthesize_node)

    # Terminal tasks -> synthesize
    for t in exec_tasks:
        if t["task_key"] not in depended_on:
            builder.add_edge(t["task_key"], "synthesize")

    builder.add_edge("synthesize", END)

    # Compile with MemorySaver for interrupt/resume support
    checkpointer = MemorySaver()
    compiled = builder.compile(checkpointer=checkpointer)

    return compiled, node_meta
