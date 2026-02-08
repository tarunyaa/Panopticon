from __future__ import annotations

import os
import re
import yaml
from dotenv import load_dotenv
from crewai import Agent, Crew, Process, Task, LLM

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
    # Running as standalone script
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



def _first_sentence_end(text: str, limit: int = 140) -> int:
    """Return the index to slice at — end of first sentence or *limit*."""
    for delim in (". ", ".\n"):
        idx = text.find(delim)
        if 0 < idx < limit:
            return idx + 1
    return min(len(text), limit)


def _summarize_task_output(text: str) -> str:
    """Produce a clean one-liner from already-cleaned output."""
    # Strip markdown headers
    text = re.sub(r"^#+\s*", "", text)
    text = re.sub(r"\n#+\s*", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    end = _first_sentence_end(text, limit=160)
    summary = text[:end]
    if len(text) > end:
        summary += "..."
    return summary


def _make_combined_task_callback(
    run_id: str,
    agent_name: str,
    role: str,
    source_agents: list,
    task_index: int,
    total_tasks: int,
    tasks_list: list,
    mode: GatingMode,
):
    """Combined callback that emits handoff event on start and handles task completion."""
    state = {"started": False}

    def callback(task_output):
        # On first execution, emit handoff and intent events
        if not state["started"]:
            state["started"] = True

            # If this task has dependencies, emit handoff event
            if source_agents and len(source_agents) > 0:
                source_names = ", ".join(source_agents)
                event_bus.emit(
                    run_id,
                    TaskHandoffEvent(
                        receivingAgent=agent_name,
                        sourceAgents=source_agents,
                        summary=f"Receiving outputs from {source_names}",
                    ),
                )

            # Emit intent event
            event_bus.emit(
                run_id,
                AgentIntentEvent(
                    agentName=agent_name,
                    zone="WORKSHOP",
                    message=f"Started working as {role.strip().lower()}.",
                ),
            )

        # Handle task completion
        cleaned = str(task_output).strip()
        summary = _summarize_task_output(cleaned)
        event_bus.emit(
            run_id,
            TaskSummaryEvent(
                agentName=agent_name,
                summary=summary,
                fullOutput=cleaned,
            ),
        )

        is_last = task_index == total_tasks - 1

        # Check gate policy
        should_gate, reason = should_gate_task_complete(
            mode=mode,
            is_last_task=is_last,
            leader_recommended=False,  # TODO: Implement leader recommendation detection
        )

        if not should_gate:
            return

        # Create gate and block until user responds
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

        resolved = gate_event.wait(timeout=600)
        if not resolved:
            raise RuntimeError(f"Gate timed out for {agent_name} (10 min)")

        response = gate_store.get_response(run_id, gate_id)
        if response is None or response.action == "reject":
            raise RuntimeError(f"Run rejected by user at {agent_name}'s gate")

        # Approved — append human feedback to the next task if provided
        if response.note and task_index + 1 < len(tasks_list):
            next_task = tasks_list[task_index + 1]
            next_task.description += f"\n\n[Human feedback]: {response.note}"

    return callback


def run_crew(run_id: str, prompt: str, mode: GatingMode = "BALANCED") -> str:
    """Build and run the crew, emitting events along the way.

    Args:
        run_id: Unique identifier for this run
        prompt: User's task prompt
        mode: Gating mode (STRICT, BALANCED, AUTO)
    """

    # Read YAML fresh each run so newly-created agents are picked up
    with open(os.path.join(_dir, "agents.yaml"), "r") as f:
        agents_config = yaml.safe_load(f)

    with open(os.path.join(_dir, "tasks.yaml"), "r") as f:
        tasks_config = yaml.safe_load(f)

    # Load delegation rules for the Leader agent during execution
    delegation_rules_path = os.path.join(_dir, "delegation_rules.md")
    delegation_rules = ""
    if os.path.exists(delegation_rules_path):
        with open(delegation_rules_path, "r", encoding="utf-8") as f:
            delegation_rules = f.read()

    event_bus.emit(run_id, RunStartedEvent(runId=run_id, prompt=prompt))

    try:
        # Step 1: Get delegation plan from Leader
        delegation_result = plan_task_delegation(prompt)

        if delegation_result["type"] == "error":
            raise ValueError(f"Delegation planning failed: {delegation_result['message']}")

        delegation_plan = delegation_result["plan"]
        planned_tasks = delegation_plan.get("tasks", [])

        if not planned_tasks:
            raise ValueError("Delegation plan has no tasks")

        # Identify the Leader agent (role contains "Leader")
        leader_key = None
        for key, config in agents_config.items():
            if "leader" in config.get("role", "").lower():
                leader_key = key
                break

        if not leader_key:
            raise ValueError("No Leader agent found in agents.yaml")

        # Create all agents (including Leader)
        agents = {}
        leader_agent = None
        worker_agents = []

        for key, config in agents_config.items():
            agent_name = key.replace("_", " ").title()

            agent_tools = instantiate_tools(config.get("tools", []))

            is_leader = (key == leader_key)

            # For the Leader, enhance backstory with delegation rules
            backstory = config["backstory"].strip()
            if is_leader and delegation_rules:
                backstory += f"\n\n## EXECUTION MODE - DELEGATION PROTOCOL\n\n{delegation_rules}"

            # Create activity tracker for this agent
            activity_tracker = ActivityTracker(run_id, agent_name)

            agent = Agent(
                role=config["role"].strip(),
                goal=config["goal"].strip(),
                backstory=backstory,
                verbose=True,
                llm=LLM(model="claude-sonnet-4-5-20250929", api_key=os.environ.get("ANTHROPIC_API_KEY")),
                tools=agent_tools,
                allow_delegation=is_leader,  # Only Leader can delegate
                callbacks=[activity_tracker],
            )

            agents[key] = agent

            if is_leader:
                leader_agent = agent
            else:
                worker_agents.append(agent)

        # Build tasks based on delegation plan
        tasks = []
        task_map = {}  # Map task_key -> Task object for building context
        task_agent_map = {}  # Map task_key -> agent_name for tracking dependencies
        total_tasks = len(planned_tasks)

        for i, plan_entry in enumerate(planned_tasks):
            task_key = plan_entry["task_key"]
            async_execution = plan_entry.get("async_execution", False)
            dependencies = plan_entry.get("dependencies", [])

            # Get task config from tasks.yaml
            if task_key not in tasks_config:
                raise ValueError(f"Task '{task_key}' in delegation plan not found in tasks.yaml")

            config = tasks_config[task_key]
            agent_key = config["agent"]

            if agent_key == leader_key:
                # Skip Leader's task
                continue

            agent_name = agent_key.replace("_", " ").title()

            desc = config["description"].strip()
            if "{prompt}" not in desc:
                desc += "\n\nUser's request: {prompt}"

            # Build context from dependencies and track source agents
            context_tasks = []
            source_agents = []
            for dep_key in dependencies:
                if dep_key in task_map:
                    context_tasks.append(task_map[dep_key])
                    # Track which agent owns this dependency task
                    if dep_key in task_agent_map:
                        source_agents.append(task_agent_map[dep_key])

            # Create combined callback that handles both handoff and task completion
            combined_callback = _make_combined_task_callback(
                run_id=run_id,
                agent_name=agent_name,
                role=agents_config[agent_key]["role"],
                source_agents=source_agents,
                task_index=i,
                total_tasks=total_tasks,
                tasks_list=tasks,
                mode=mode,
            )

            task = Task(
                description=desc.format(prompt=prompt),
                expected_output=config["expected_output"].strip(),
                agent=agents[agent_key],
                callback=combined_callback,
                async_execution=async_execution,  # From delegation plan
                context=context_tasks if context_tasks else None,
            )

            tasks.append(task)
            task_map[task_key] = task
            task_agent_map[task_key] = agent_name

        # Use the Leader agent as the manager for hierarchical delegation
        crew = Crew(
            agents=worker_agents,  # Only worker agents, not the Leader
            tasks=tasks,
            process=Process.hierarchical,
            manager_agent=leader_agent,  # Leader orchestrates task delegation
            planning=False,  # Disable planning to avoid OpenAI dependency
            verbose=True,
        )

        result = crew.kickoff()

        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return str(result)

    except Exception as e:
        event_bus.emit(run_id, ErrorEvent(message=str(e)))
        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return f"Error: {e}"
    finally:
        gate_store.cleanup(run_id)
