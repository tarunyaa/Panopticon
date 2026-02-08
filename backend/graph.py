"""LangGraph-based agent orchestration engine.

Builds a dynamic StateGraph from the delegation plan and runs worker agents
via create_react_agent. Parallel fan-out / fan-in is handled natively by
LangGraph's edge semantics.
"""
from __future__ import annotations

import os
import re
import yaml
from typing import Any, Annotated
from typing_extensions import TypedDict

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

try:
    from .events import (
        event_bus,
        gate_store,
        AgentIntentEvent,
        TaskSummaryEvent,
        GateRequestedEvent,
        RunStartedEvent,
        RunFinishedEvent,
        ErrorEvent,
        TaskHandoffEvent,
        GatingMode,
    )
    from .tools import instantiate_tools
    from .planner import plan_task_delegation
    from .gate_policy import should_gate_task_complete
    from .activity_callbacks import ActivityTracker
except ImportError:
    from events import (
        event_bus,
        gate_store,
        AgentIntentEvent,
        TaskSummaryEvent,
        GateRequestedEvent,
        RunStartedEvent,
        RunFinishedEvent,
        ErrorEvent,
        TaskHandoffEvent,
        GatingMode,
    )
    from tools import instantiate_tools
    from planner import plan_task_delegation
    from gate_policy import should_gate_task_complete
    from activity_callbacks import ActivityTracker

_dir = os.path.dirname(os.path.abspath(__file__))

_MODEL = "claude-sonnet-4-5-20250929"


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

def _merge_dicts(a: dict, b: dict) -> dict:
    return {**a, **b}


class PanopticonState(TypedDict):
    run_id: str
    prompt: str
    gating_mode: str
    task_outputs: Annotated[dict, _merge_dicts]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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

def _make_worker_node(
    agent_key: str,
    agent_config: dict,
    task_config: dict,
    task_key: str,
    dependencies: list[str],
    task_agent_map: dict[str, str],
    mode: GatingMode,
    task_index: int,
    total_tasks: int,
):
    """Return a closure that runs a single worker agent inside the StateGraph."""

    agent_name = agent_key.replace("_", " ").title()

    def worker_node(state: PanopticonState) -> dict[str, Any]:
        run_id = state["run_id"]
        prompt = state["prompt"]

        # Emit handoff event if this task has dependencies
        source_agents = [task_agent_map[d] for d in dependencies if d in task_agent_map]
        if source_agents:
            event_bus.emit(
                run_id,
                TaskHandoffEvent(
                    receivingAgent=agent_name,
                    sourceAgents=source_agents,
                    summary=f"Receiving outputs from {', '.join(source_agents)}",
                ),
            )

        # Emit intent event
        event_bus.emit(
            run_id,
            AgentIntentEvent(
                agentName=agent_name,
                zone="WORKSHOP",
                message=f"Started working as {agent_config['role'].strip().lower()}.",
            ),
        )

        # Build tools and LLM
        agent_tools = instantiate_tools(agent_config.get("tools", []))
        activity_tracker = ActivityTracker(run_id, agent_name)

        llm = ChatAnthropic(
            model=_MODEL,
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            callbacks=[activity_tracker],
            max_tokens=4096,
        )

        # System prompt
        system_msg = (
            f"You are {agent_name}.\n"
            f"Role: {agent_config['role'].strip()}\n"
            f"Goal: {agent_config['goal'].strip()}\n"
            f"Backstory: {agent_config['backstory'].strip()}\n\n"
            f"Complete the task described below. Be thorough and produce high-quality output.\n"
            f"When you are done, provide your final answer directly — do not use any special markers.\n\n"
            f"TOOL USE RULES:\n"
            f"- Only use tools when you NEED external information you do not already know.\n"
            f"- Do NOT search for things you can answer from your own knowledge.\n"
            f"- web_search is for quick fact lookups (recent stats, prices, current events) — not general knowledge.\n"
            f"- web_scraper is only for reading a specific URL you already have — never scrape speculatively.\n"
            f"- Prefer producing your answer directly over unnecessary tool calls."
        )

        # Build task description
        desc = task_config["description"].strip()
        if "{prompt}" in desc:
            desc = desc.replace("{prompt}", prompt)
        else:
            desc += f"\n\nUser's request: {prompt}"

        # Append context from dependencies
        context_parts = []
        task_outputs = state.get("task_outputs", {})
        for dep_key in dependencies:
            if dep_key in task_outputs:
                dep_agent = task_agent_map.get(dep_key, dep_key)
                context_parts.append(f"--- Output from {dep_agent} ---\n{task_outputs[dep_key]}")

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

        result = react_agent.invoke({"messages": [HumanMessage(content=desc)]})

        # Extract final output from last AI message
        final_output = ""
        for msg in reversed(result["messages"]):
            if hasattr(msg, "content") and isinstance(msg.content, str) and msg.content.strip():
                final_output = msg.content
                break
        if not final_output:
            final_output = str(result["messages"][-1].content) if result["messages"] else "(no output)"

        # Emit task summary
        summary = _summarize_output(final_output)
        event_bus.emit(
            run_id,
            TaskSummaryEvent(
                agentName=agent_name,
                summary=summary,
                fullOutput=final_output,
            ),
        )

        # Gate logic
        is_last = task_index == total_tasks - 1
        should_gate, reason = should_gate_task_complete(
            mode=mode,
            is_last_task=is_last,
            leader_recommended=False,
        )

        if should_gate:
            gate_id, gate_event = gate_store.create_gate(run_id)

            question = f"{agent_name} finished their task. Continue?"
            if is_last:
                question = "Final deliverable ready. Approve?"

            event_bus.emit(
                run_id,
                GateRequestedEvent(
                    gateId=gate_id,
                    runId=run_id,
                    agentName=agent_name,
                    question=question,
                    context=summary,
                    reason=reason,
                    gateSource="task_complete",
                ),
            )

            resolved = gate_event.wait(600)
            if not resolved:
                raise RuntimeError(f"Gate timed out for {agent_name} (10 min)")

            gate_response = gate_store.get_response(run_id, gate_id)
            if gate_response is None or gate_response.action == "reject":
                raise RuntimeError(f"Run rejected by user at {agent_name}'s gate")

        return {"task_outputs": {task_key: final_output}}

    return worker_node


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def _build_graph(
    exec_tasks: list[dict],
    agents_config: dict,
    tasks_config: dict,
    task_agent_map: dict[str, str],
    mode: GatingMode,
) -> StateGraph:
    """Build a StateGraph from the delegation plan's executable tasks."""

    graph = StateGraph(PanopticonState)
    total_tasks = len(exec_tasks)
    task_keys = {t["task_key"] for t in exec_tasks}

    # Track which tasks are depended on (to find terminal tasks)
    depended_on: set[str] = set()

    for i, plan_entry in enumerate(exec_tasks):
        task_key = plan_entry["task_key"]
        task_cfg = tasks_config[task_key]
        agent_key = task_cfg["agent"]
        agent_cfg = agents_config[agent_key]
        deps = [d for d in plan_entry.get("dependencies", []) if d in task_keys]

        # Add node
        node_fn = _make_worker_node(
            agent_key=agent_key,
            agent_config=agent_cfg,
            task_config=task_cfg,
            task_key=task_key,
            dependencies=deps,
            task_agent_map=task_agent_map,
            mode=mode,
            task_index=i,
            total_tasks=total_tasks,
        )
        graph.add_node(task_key, node_fn)

        # Add edges
        if not deps:
            graph.add_edge(START, task_key)
        else:
            for dep_key in deps:
                graph.add_edge(dep_key, task_key)
                depended_on.add(dep_key)

    # Terminal tasks → END
    for t in exec_tasks:
        if t["task_key"] not in depended_on:
            graph.add_edge(t["task_key"], END)

    return graph


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def _build_and_run_graph(run_id: str, prompt: str, mode: GatingMode) -> str:
    """Build the StateGraph from delegation plan and execute it."""

    # Read YAML configs
    with open(os.path.join(_dir, "agents.yaml"), "r") as f:
        agents_config = yaml.safe_load(f)

    with open(os.path.join(_dir, "tasks.yaml"), "r") as f:
        tasks_config = yaml.safe_load(f)

    event_bus.emit(run_id, RunStartedEvent(runId=run_id, prompt=prompt))

    try:
        # Step 1: Get delegation plan from planner
        delegation_result = plan_task_delegation(prompt)

        if delegation_result["type"] == "error":
            raise ValueError(f"Delegation planning failed: {delegation_result['message']}")

        delegation_plan = delegation_result["plan"]
        planned_tasks = delegation_plan.get("tasks", [])

        if not planned_tasks:
            raise ValueError("Delegation plan has no tasks")

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

        # Build task→agent mapping
        task_agent_map: dict[str, str] = {}
        for t in exec_tasks:
            agent_key = tasks_config[t["task_key"]]["agent"]
            task_agent_map[t["task_key"]] = agent_key.replace("_", " ").title()

        # Step 2: Build and compile the StateGraph
        graph = _build_graph(exec_tasks, agents_config, tasks_config, task_agent_map, mode)
        compiled = graph.compile()

        # Step 3: Run the graph (sync — LangGraph manages threads internally)
        final_state = compiled.invoke({
            "run_id": run_id,
            "prompt": prompt,
            "gating_mode": mode,
            "task_outputs": {},
        })

        context_results = final_state.get("task_outputs", {})

        # Step 4: Synthesize final output
        last_task_key = exec_tasks[-1]["task_key"]
        final_output = context_results.get(last_task_key, "")

        if len(exec_tasks) > 1 and final_output:
            llm = ChatAnthropic(
                model=_MODEL,
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                max_tokens=4096,
            )

            all_outputs = "\n\n".join(
                f"## {task_agent_map.get(t['task_key'], t['task_key'])}\n{context_results.get(t['task_key'], '(no output)')}"
                for t in exec_tasks
            )

            synthesis_msg = llm.invoke([
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

            final_output = synthesis_msg.content if isinstance(synthesis_msg.content, str) else str(synthesis_msg.content)

        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return final_output

    except Exception as e:
        event_bus.emit(run_id, ErrorEvent(message=str(e)))
        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return f"Error: {e}"
    finally:
        gate_store.cleanup(run_id)


def run_graph(run_id: str, prompt: str, mode: GatingMode = "BALANCED") -> str:
    """Build and run the agent graph, emitting events along the way.

    This is the synchronous entry point called from main.py's thread pool.

    Args:
        run_id: Unique identifier for this run
        prompt: User's task prompt
        mode: Gating mode (STRICT, BALANCED, AUTO)
    """
    return _build_and_run_graph(run_id, prompt, mode)
