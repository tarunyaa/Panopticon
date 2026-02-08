"""End-to-end tests: full crew execution from planning to completion.

Tests:
  - Full task execution with real LLM calls
  - HTTP API integration (requires running server)
"""

import os
import sys
import uuid
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / ".env")

from planner import plan_task_delegation
from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools

_dir = Path(__file__).parent


def _ensure_team():
    """Create a minimal team if one doesn't exist. Returns True if ready."""
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"

    if agents_path.exists() and tasks_path.exists():
        return True

    print("  Creating minimal test team...")

    agents = {
        "leader": {
            "role": "Leader",
            "goal": "Coordinate the team and ensure task completion",
            "backstory": "An experienced team leader.",
            "tools": [],
        },
        "researcher": {
            "role": "Researcher",
            "goal": "Research topics and gather information",
            "backstory": "A skilled researcher.",
            "tools": ["web_search"],
        },
        "writer": {
            "role": "Writer",
            "goal": "Write clear and concise content",
            "backstory": "A talented writer.",
            "tools": [],
        },
    }

    tasks = {
        "leader_task": {
            "description": "Coordinate the team for: {prompt}",
            "expected_output": "Confirmation of task completion",
            "agent": "leader",
        },
        "researcher_task": {
            "description": "Research the following topic: {prompt}",
            "expected_output": "A brief summary of key findings (2-3 sentences)",
            "agent": "researcher",
        },
        "writer_task": {
            "description": "Write a short response based on the research for: {prompt}",
            "expected_output": "A concise written response (1 paragraph)",
            "agent": "writer",
        },
    }

    with open(agents_path, "w") as f:
        yaml.dump(agents, f, sort_keys=False)
    with open(tasks_path, "w") as f:
        yaml.dump(tasks, f, sort_keys=False)
    return True


def _build_crew(agents_config, tasks_config, planned_tasks, test_task):
    """Build CrewAI objects from config. Returns (worker_agents, crew_tasks, leader_agent)."""
    leader_key = None
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            leader_key = key
            break
    assert leader_key, "No Leader agent in agents.yaml"

    agents = {}
    worker_agents = []
    leader_agent = None

    for key, config in agents_config.items():
        is_leader = key == leader_key
        agent = Agent(
            role=config["role"].strip(),
            goal=config["goal"].strip(),
            backstory=config["backstory"].strip(),
            verbose=False,
            llm=LLM(model="claude-sonnet-4-5-20250929", api_key=os.environ.get("ANTHROPIC_API_KEY")),
            tools=instantiate_tools(config.get("tools", [])),
            allow_delegation=is_leader,
        )
        agents[key] = agent
        if is_leader:
            leader_agent = agent
        else:
            worker_agents.append(agent)

    crew_tasks = []
    task_map = {}

    for entry in planned_tasks:
        task_key = entry["task_key"]
        if task_key not in tasks_config:
            continue
        config = tasks_config[task_key]
        if config["agent"] == leader_key:
            continue

        desc = config["description"]
        if "{prompt}" not in desc:
            desc += "\n\nUser's request: {prompt}"

        context_tasks = [task_map[d] for d in entry.get("dependencies", []) if d in task_map]

        task = Task(
            description=desc.format(prompt=test_task),
            expected_output=config["expected_output"].strip(),
            agent=agents[config["agent"]],
            async_execution=entry.get("async_execution", False),
            context=context_tasks or None,
        )
        crew_tasks.append(task)
        task_map[task_key] = task

    return worker_agents, crew_tasks, leader_agent


def test_full_execution():
    """Plan delegation and execute the full crew end-to-end."""
    print("=" * 60)
    print("TEST: Full end-to-end execution")
    print("=" * 60)

    if not _ensure_team():
        print("  FAILED: Could not set up team\n")
        return False

    with open(_dir / "agents.yaml") as f:
        agents_config = yaml.safe_load(f)
    with open(_dir / "tasks.yaml") as f:
        tasks_config = yaml.safe_load(f)

    test_task = "What are the main benefits of renewable energy? Keep it brief."

    print(f"  Task: {test_task}")
    print("  Creating delegation plan...")

    result = plan_task_delegation(test_task)
    if result["type"] == "error":
        print(f"  FAILED: {result['message']}\n")
        return False

    planned_tasks = result["plan"].get("tasks", [])
    print(f"  Plan: {len(planned_tasks)} tasks")

    print("  Building and executing crew...")
    worker_agents, crew_tasks, leader_agent = _build_crew(
        agents_config, tasks_config, planned_tasks, test_task
    )

    crew = Crew(
        agents=worker_agents,
        tasks=crew_tasks,
        process=Process.hierarchical,
        manager_agent=leader_agent,
        planning=False,
        verbose=False,
    )

    output = crew.kickoff()
    output_str = str(output).strip()

    assert len(output_str) > 0, "Empty output"
    print(f"  Output preview: {output_str[:150]}...")
    print("  PASSED\n")
    return True


def test_http_api():
    """Test the backend HTTP API (requires server running on localhost:8000)."""
    print("=" * 60)
    print("TEST: HTTP API integration")
    print("=" * 60)

    try:
        import requests
    except ImportError:
        print("  SKIPPED (requests not installed)\n")
        return True

    api = "http://localhost:8000"
    try:
        resp = requests.get(f"{api}/agents", timeout=3)
    except Exception:
        print("  SKIPPED (server not running)\n")
        return True

    assert resp.status_code == 200, f"GET /agents returned {resp.status_code}"
    data = resp.json()
    print(f"  GET /agents: {len(data['agents'])} agents")

    # Test plan-team endpoint
    resp = requests.post(
        f"{api}/plan-team",
        json={"team_description": "content creation team", "history": []},
        timeout=60,
    )
    assert resp.status_code == 200, f"POST /plan-team returned {resp.status_code}"
    result = resp.json()
    print(f"  POST /plan-team: type={result['type']}")

    # Test run endpoint
    resp = requests.post(
        f"{api}/run",
        json={"prompt": "Write one sentence about the sky."},
        timeout=5,
    )
    assert resp.status_code == 200, f"POST /run returned {resp.status_code}"
    run_data = resp.json()
    print(f"  POST /run: runId={run_data['runId']}")

    print("  PASSED\n")
    return True


if __name__ == "__main__":
    results = []
    for test_fn in [test_full_execution, test_http_api]:
        try:
            results.append(test_fn())
        except Exception as e:
            print(f"  FAILED with exception: {e}\n")
            import traceback
            traceback.print_exc()
            results.append(False)

    print("=" * 60)
    passed = sum(results)
    print(f"Results: {passed}/{len(results)} passed")
    sys.exit(0 if all(results) else 1)
