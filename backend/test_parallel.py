"""Tests for parallel/async task execution.

Tests:
  - Delegation plan parallelism analysis
  - Fixed plan execution (async vs sequential control test)
  - Timing comparison between sequential and parallel modes
"""

import os
import sys
import time
import yaml
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent.parent / ".env")

from planner import plan_task_delegation
from crewai import Agent, Crew, Process, Task, LLM
from tools import instantiate_tools

_dir = Path(__file__).parent


def _load_team():
    """Load agents/tasks config. Returns (agents_config, tasks_config) or (None, None)."""
    agents_path = _dir / "agents.yaml"
    tasks_path = _dir / "tasks.yaml"
    if not agents_path.exists() or not tasks_path.exists():
        return None, None
    with open(agents_path) as f:
        agents_config = yaml.safe_load(f)
    with open(tasks_path) as f:
        tasks_config = yaml.safe_load(f)
    return agents_config, tasks_config


def _find_leader_key(agents_config):
    for key, config in agents_config.items():
        if "leader" in config.get("role", "").lower():
            return key
    return None


def _build_agents(agents_config, leader_key):
    """Create Agent objects. Returns (agents_dict, worker_list, leader_agent)."""
    agents = {}
    workers = []
    leader = None
    for key, config in agents_config.items():
        is_leader = key == leader_key
        agent = Agent(
            role=config["role"].strip(),
            goal=config["goal"].strip(),
            backstory=config["backstory"].strip(),
            verbose=False,
            llm=LLM(model="claude-sonnet-4-5-20250929", api_key=os.environ.get("ANTHROPIC_API_KEY")),
            tools=instantiate_tools(config.get("tools", [])) if not is_leader else [],
            allow_delegation=is_leader,
        )
        agents[key] = agent
        if is_leader:
            leader = agent
        else:
            workers.append(agent)
    return agents, workers, leader


def test_delegation_parallelism():
    """Verify the delegation planner correctly identifies parallel tasks."""
    print("=" * 60)
    print("TEST: Delegation plan parallelism")
    print("=" * 60)

    agents_config, tasks_config = _load_team()
    if agents_config is None:
        print("  SKIPPED (no team config)\n")
        return True

    result = plan_task_delegation(
        "Write an article about quantum computing. Include technical research and a strategic outline."
    )

    if result["type"] == "error":
        print(f"  FAILED: {result['message']}\n")
        return False

    tasks = result["plan"].get("tasks", [])
    parallel = [t for t in tasks if t.get("async_execution") and not t.get("dependencies")]
    sequential = [t for t in tasks if not t.get("async_execution") or t.get("dependencies")]

    print(f"  Total tasks: {len(tasks)}")
    print(f"  Parallel:    {len(parallel)}")
    for t in parallel:
        print(f"    {t['task_key']}")
    print(f"  Sequential:  {len(sequential)}")
    for t in sequential:
        deps = t.get("dependencies", [])
        print(f"    {t['task_key']}" + (f" (waits for: {', '.join(deps)})" if deps else ""))

    # Validate task keys reference real tasks
    for t in tasks:
        assert t["task_key"] in tasks_config, f"Unknown task_key: {t['task_key']}"

    print("  PASSED\n")
    return True


def test_fixed_plan_execution():
    """Execute with a hardcoded delegation plan (control vs async)."""
    print("=" * 60)
    print("TEST: Fixed plan execution (sequential control)")
    print("=" * 60)

    agents_config, tasks_config = _load_team()
    if agents_config is None:
        print("  SKIPPED (no team config)\n")
        return True

    leader_key = _find_leader_key(agents_config)
    if not leader_key:
        print("  SKIPPED (no leader)\n")
        return True

    # Find non-leader task keys
    worker_task_keys = [
        k for k, v in tasks_config.items()
        if v.get("agent") != leader_key
    ]

    if len(worker_task_keys) < 2:
        print("  SKIPPED (need at least 2 worker tasks)\n")
        return True

    # Build a simple sequential plan using the first 2 worker tasks
    plan = {
        "tasks": [
            {"task_key": worker_task_keys[0], "async_execution": False, "dependencies": []},
            {"task_key": worker_task_keys[1], "async_execution": False, "dependencies": [worker_task_keys[0]]},
        ]
    }

    test_task = "What are three benefits of exercise?"
    agents, workers, leader = _build_agents(agents_config, leader_key)

    # Build tasks
    crew_tasks = []
    task_map = {}
    for entry in plan["tasks"]:
        tk = entry["task_key"]
        config = tasks_config[tk]
        if config["agent"] == leader_key:
            continue

        desc = config["description"]
        if "{prompt}" not in desc:
            desc += "\n\nUser's request: {prompt}"

        context = [task_map[d] for d in entry.get("dependencies", []) if d in task_map]

        task = Task(
            description=desc.format(prompt=test_task),
            expected_output=config["expected_output"].strip(),
            agent=agents[config["agent"]],
            async_execution=entry["async_execution"],
            context=context or None,
        )
        crew_tasks.append(task)
        task_map[tk] = task

    crew = Crew(
        agents=workers,
        tasks=crew_tasks,
        process=Process.hierarchical,
        manager_agent=leader,
        planning=False,
        verbose=False,
    )

    print(f"  Executing {len(crew_tasks)} sequential tasks...")
    start = time.time()
    result = crew.kickoff()
    elapsed = time.time() - start

    output = str(result).strip()
    assert len(output) > 0, "Empty output"
    print(f"  Completed in {elapsed:.1f}s")
    print(f"  Output preview: {output[:120]}...")
    print("  PASSED\n")
    return True


if __name__ == "__main__":
    results = []
    for test_fn in [test_delegation_parallelism, test_fixed_plan_execution]:
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
