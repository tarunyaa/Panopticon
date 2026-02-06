from __future__ import annotations

import os
import re
import yaml
from dotenv import load_dotenv
from crewai import Agent, Crew, Process, Task, LLM

# Load .env from panopticon dir (has ANTHROPIC_API_KEY)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "panopticon", ".env"))

from events import (
    event_bus,
    AgentIntentEvent,
    TaskSummaryEvent,
    RunStartedEvent,
    RunFinishedEvent,
    ErrorEvent,
)

_dir = os.path.dirname(os.path.abspath(__file__))


def _first_sentence_end(text: str, limit: int = 140) -> int:
    """Return the index to slice at — end of first sentence or *limit*."""
    for delim in (". ", ".\n"):
        idx = text.find(delim)
        if 0 < idx < limit:
            return idx + 1
    return min(len(text), limit)


def _summarize_task_output(raw: str) -> str:
    """Produce a clean one-liner from a task's final output."""
    text = raw.strip()
    text = re.sub(r"^#+\s*", "", text)
    end = _first_sentence_end(text, limit=160)
    summary = text[:end]
    if len(text) > end:
        summary += "..."
    return summary


def _make_intent_step_callback(run_id: str, agent_name: str, zone: str):
    """Emit a single AGENT_INTENT the first time the agent takes a step,
    then go silent.  This way the intent fires when the agent *actually*
    starts working rather than all-at-once upfront."""
    fired = {"done": False}

    def callback(step_output):
        if not fired["done"]:
            fired["done"] = True
            event_bus.emit(
                run_id,
                AgentIntentEvent(
                    agentName=agent_name,
                    zone=zone,
                    message=f"{agent_name} heading to {zone}",
                ),
            )

    return callback


def _make_task_callback(run_id: str, agent_name: str, zone: str):
    """Emit a TASK_SUMMARY when the agent's task finishes."""

    def callback(task_output):
        raw = str(task_output)
        summary = _summarize_task_output(raw)
        event_bus.emit(
            run_id,
            TaskSummaryEvent(
                agentName=agent_name,
                summary=summary,
                fullOutput=raw,
            ),
        )

    return callback


def run_crew(run_id: str, prompt: str) -> str:
    """Build and run the crew, emitting events along the way."""

    # Read YAML fresh each run so newly-created agents are picked up
    with open(os.path.join(_dir, "agents.yaml"), "r") as f:
        agents_config = yaml.safe_load(f)

    with open(os.path.join(_dir, "tasks.yaml"), "r") as f:
        tasks_config = yaml.safe_load(f)

    event_bus.emit(run_id, RunStartedEvent(runId=run_id, prompt=prompt))

    try:
        agents = {}
        for key, config in agents_config.items():
            zone = config.get("zone", "PARK")
            agent_name = key.replace("_", " ").title()

            agents[key] = Agent(
                role=config["role"].strip(),
                goal=config["goal"].strip(),
                backstory=config["backstory"].strip(),
                verbose=True,
                llm=LLM(model="anthropic/claude-sonnet-4-20250514"),
                step_callback=_make_intent_step_callback(run_id, agent_name, zone),
            )

        tasks = []
        for key, config in tasks_config.items():
            agent_key = config["agent"]
            agent_name = agent_key.replace("_", " ").title()
            agent_config = agents_config.get(agent_key, {})
            zone = agent_config.get("zone", "PARK")

            task = Task(
                description=config["description"].strip().format(prompt=prompt),
                expected_output=config["expected_output"].strip(),
                agent=agents[agent_key],
                callback=_make_task_callback(run_id, agent_name, zone),
            )
            tasks.append(task)

        crew = Crew(
            agents=list(agents.values()),
            tasks=tasks,
            process=Process.sequential,
            verbose=True,
        )

        result = crew.kickoff()

        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return str(result)

    except Exception as e:
        event_bus.emit(run_id, ErrorEvent(message=str(e)))
        event_bus.emit(run_id, RunFinishedEvent(runId=run_id))
        return f"Error: {e}"
