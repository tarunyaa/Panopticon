"""LangGraph-based agent orchestration engine.

Replaces crew.py (CrewAI). Provides run_graph() which builds a dynamic
execution graph from the delegation plan and runs worker agents in
true parallel via asyncio.gather().
"""
from __future__ import annotations

import asyncio
import os
import re
import yaml
from typing import Any

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate

# Load .env from panopticon dir (has ANTHROPIC_API_KEY)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "panopticon", ".env"))

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
        AgentActivityEvent,
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
        AgentActivityEvent,
        GatingMode,
    )
    from tools import instantiate_tools
    from planner import plan_task_delegation
    from gate_policy import should_gate_task_complete
    from activity_callbacks import ActivityTracker

_dir = os.path.dirname(os.path.abspath(__file__))

_MODEL = "claude-sonnet-4-5-20250929"


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


def _topological_levels(tasks: list[dict]) -> list[list[dict]]:
    """Group planned tasks into topological levels for parallel execution.

    Tasks with no dependencies go into level 0. Tasks whose dependencies are
    all in earlier levels go into the next level. This lets us run each level
    with asyncio.gather().
    """
    task_by_key = {t["task_key"]: t for t in tasks}
    assigned: dict[str, int] = {}
    levels: list[list[dict]] = []

    # Iteratively assign levels
    remaining = list(tasks)
    while remaining:
        next_remaining = []
        current_level = []
        for t in remaining:
            deps = t.get("dependencies", [])
            if all(d in assigned for d in deps):
                level = 0
                if deps:
                    level = max(assigned[d] for d in deps) + 1
                assigned[t["task_key"]] = level
                current_level.append(t)
            else:
                next_remaining.append(t)

        if not current_level:
            # Circular dependency or missing tasks — force remaining into next level
            for t in next_remaining:
                current_level.append(t)
                assigned[t["task_key"]] = len(levels)
            next_remaining = []

        levels_needed = max(assigned[t["task_key"]] for t in current_level) + 1
        while len(levels) < levels_needed:
            levels.append([])
        for t in current_level:
            levels[assigned[t["task_key"]]].append(t)

        remaining = next_remaining

    return [lvl for lvl in levels if lvl]


# ---------------------------------------------------------------------------
# Single worker agent execution
# ---------------------------------------------------------------------------


async def _run_worker(
    run_id: str,
    agent_key: str,
    agent_config: dict,
    task_config: dict,
    prompt: str,
    context_results: dict[str, str],
    dependencies: list[str],
    task_agent_map: dict[str, str],
    mode: GatingMode,
    task_index: int,
    total_tasks: int,
) -> str:
    """Run a single worker agent and return its output string."""

    agent_name = agent_key.replace("_", " ").title()

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

    # Build the agent's tools
    agent_tools = instantiate_tools(agent_config.get("tools", []))

    # Create activity tracker callback
    activity_tracker = ActivityTracker(run_id, agent_name)

    # Build LLM
    llm = ChatAnthropic(
        model=_MODEL,
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        callbacks=[activity_tracker],
        max_tokens=4096,
    )

    # Bind tools if any
    if agent_tools:
        llm_with_tools = llm.bind_tools(agent_tools)
    else:
        llm_with_tools = llm

    # Build system message from agent config
    system_msg = (
        f"You are {agent_name}.\n"
        f"Role: {agent_config['role'].strip()}\n"
        f"Goal: {agent_config['goal'].strip()}\n"
        f"Backstory: {agent_config['backstory'].strip()}\n\n"
        f"Complete the task described below. Be thorough and produce high-quality output.\n"
        f"When you are done, provide your final answer directly — do not use any special markers."
    )

    # Build task description
    desc = task_config["description"].strip()
    if "{prompt}" in desc:
        desc = desc.replace("{prompt}", prompt)
    else:
        desc += f"\n\nUser's request: {prompt}"

    # Append context from dependencies
    context_parts = []
    for dep_key in dependencies:
        if dep_key in context_results:
            dep_agent = task_agent_map.get(dep_key, dep_key)
            context_parts.append(f"--- Output from {dep_agent} ---\n{context_results[dep_key]}")

    if context_parts:
        desc += "\n\n## Context from previous agents\n\n" + "\n\n".join(context_parts)

    expected = task_config.get("expected_output", "").strip()
    if expected:
        desc += f"\n\n## Expected Output\n{expected}"

    # Run the agent with tool-calling loop
    messages = [
        SystemMessage(content=system_msg),
        HumanMessage(content=desc),
    ]

    # Tool-calling loop: keep calling until the model stops using tools
    max_iterations = 10
    for _ in range(max_iterations):
        response = await llm_with_tools.ainvoke(messages)
        messages.append(response)

        # Check if the model made tool calls
        if not response.tool_calls:
            break

        # Execute each tool call
        from langchain_core.messages import ToolMessage

        for tool_call in response.tool_calls:
            # Emit tool activity
            event_bus.emit(
                run_id,
                AgentActivityEvent(
                    agentName=agent_name,
                    activity="tool_call",
                    details=f"Using {tool_call['name']}",
                ),
            )

            # Find and execute the tool
            tool_result = f"Tool '{tool_call['name']}' not found"
            for t in agent_tools:
                if t.name == tool_call["name"]:
                    try:
                        tool_result = await asyncio.to_thread(
                            t.invoke, tool_call["args"]
                        )
                    except Exception as e:
                        tool_result = f"Tool error: {e}"
                    break

            messages.append(
                ToolMessage(
                    content=str(tool_result),
                    tool_call_id=tool_call["id"],
                )
            )

            # Back to idle after tool
            event_bus.emit(
                run_id,
                AgentActivityEvent(
                    agentName=agent_name,
                    activity="idle",
                    details="",
                ),
            )

    # Extract final output
    final_output = response.content if isinstance(response.content, str) else str(response.content)

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

    # Check gate policy
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

        # Block until user responds (run in thread to not block event loop)
        resolved = await asyncio.to_thread(gate_event.wait, 600)
        if not resolved:
            raise RuntimeError(f"Gate timed out for {agent_name} (10 min)")

        gate_response = gate_store.get_response(run_id, gate_id)
        if gate_response is None or gate_response.action == "reject":
            raise RuntimeError(f"Run rejected by user at {agent_name}'s gate")

    return final_output


# ---------------------------------------------------------------------------
# Main entry point: run_graph
# ---------------------------------------------------------------------------


def run_graph(run_id: str, prompt: str, mode: GatingMode = "BALANCED") -> str:
    """Build and run the agent graph, emitting events along the way.

    This is the synchronous entry point called from main.py's thread pool.
    Internally it creates an event loop for async execution.

    Args:
        run_id: Unique identifier for this run
        prompt: User's task prompt
        mode: Gating mode (STRICT, BALANCED, AUTO)
    """
    # Create a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_run_graph_async(run_id, prompt, mode))
    finally:
        loop.close()


async def _run_graph_async(run_id: str, prompt: str, mode: GatingMode) -> str:
    """Async implementation of the agent execution graph."""

    # Read YAML configs
    with open(os.path.join(_dir, "agents.yaml"), "r") as f:
        agents_config = yaml.safe_load(f)

    with open(os.path.join(_dir, "tasks.yaml"), "r") as f:
        tasks_config = yaml.safe_load(f)

    event_bus.emit(run_id, RunStartedEvent(runId=run_id, prompt=prompt))

    try:
        # Step 1: Get delegation plan from planner
        delegation_result = await asyncio.to_thread(plan_task_delegation, prompt)

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

        total_tasks = len(exec_tasks)

        # Build task→agent mapping
        task_agent_map: dict[str, str] = {}
        for t in exec_tasks:
            agent_key = tasks_config[t["task_key"]]["agent"]
            task_agent_map[t["task_key"]] = agent_key.replace("_", " ").title()

        # Step 2: Group tasks into parallel levels
        levels = _topological_levels(exec_tasks)

        # Step 3: Execute level by level with true parallel execution
        context_results: dict[str, str] = {}
        global_task_idx = 0

        for level in levels:
            # All tasks in this level can run in parallel
            coros = []
            for plan_entry in level:
                task_key = plan_entry["task_key"]
                task_cfg = tasks_config[task_key]
                agent_key = task_cfg["agent"]
                agent_cfg = agents_config[agent_key]
                deps = plan_entry.get("dependencies", [])

                coros.append(
                    _run_worker(
                        run_id=run_id,
                        agent_key=agent_key,
                        agent_config=agent_cfg,
                        task_config=task_cfg,
                        prompt=prompt,
                        context_results=context_results,
                        dependencies=deps,
                        task_agent_map=task_agent_map,
                        mode=mode,
                        task_index=global_task_idx,
                        total_tasks=total_tasks,
                    )
                )
                global_task_idx += 1

            # Run all tasks in this level concurrently
            results = await asyncio.gather(*coros, return_exceptions=True)

            # Collect results, raising first exception
            for plan_entry, result in zip(level, results):
                if isinstance(result, Exception):
                    raise result
                context_results[plan_entry["task_key"]] = result

        # Step 4: Synthesize final output
        # The last task's output is the final deliverable
        last_task_key = exec_tasks[-1]["task_key"]
        final_output = context_results.get(last_task_key, "")

        # If multiple tasks ran, provide a combined summary
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

            final_output = synthesis_msg.content if isinstance(synthesis_msg.content, str) else str(synthesis_msg.content)

        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return final_output

    except Exception as e:
        event_bus.emit(run_id, ErrorEvent(message=str(e)))
        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return f"Error: {e}"
    finally:
        gate_store.cleanup(run_id)
