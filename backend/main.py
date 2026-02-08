from __future__ import annotations

import asyncio
import json
import os
import re
import threading
import uuid
from contextlib import asynccontextmanager
from typing import Any, List

from dotenv import load_dotenv

# Load env BEFORE any LangChain imports
_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "..", ".env"))

import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langgraph.types import Command

from .events import GateResponse, GatingMode
from .graph import build_execution_graph, _summarize_output
from .tools import get_available_tools, TOOL_REGISTRY
from .planner import plan_team, plan_task_delegation


# ---------------------------------------------------------------------------
# Run state (replaces EventBus + GateStore)
# ---------------------------------------------------------------------------

_pending_runs: dict[str, dict] = {}             # run_id -> {prompt, mode}
_gate_signals: dict[str, asyncio.Event] = {}    # run_id -> signal when gate resolved
_gate_responses: dict[str, dict] = {}           # run_id -> {action, note}
_run_graphs: dict[str, Any] = {}                # run_id -> compiled graph (for resume)

_yaml_lock = threading.Lock()

AGENTS_YAML = os.path.join(_dir, "agents.yaml")
TASKS_YAML = os.path.join(_dir, "tasks.yaml")

MAX_AGENTS = 6


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    prompt: str
    mode: str = "BALANCED"  # "STRICT" | "BALANCED" | "AUTO"


class RunResponse(BaseModel):
    runId: str


class CreateAgentRequest(BaseModel):
    agent_id: str
    role: str
    goal: str
    backstory: str
    task_description: str
    expected_output: str
    tools: List[str] = []


class SetupAgentItem(BaseModel):
    agent_id: str
    role: str
    goal: str
    backstory: str
    task_description: str
    expected_output: str
    tools: List[str] = []


class SetupAgentsRequest(BaseModel):
    agents: List[SetupAgentItem]


class PlanTeamMessage(BaseModel):
    role: str  # "leader" | "user"
    content: str


class PlanTeamRequest(BaseModel):
    team_description: str
    history: List[PlanTeamMessage] = []


class GateResponseRequest(BaseModel):
    action: str  # "approve" | "reject"
    note: str = ""


# ---------------------------------------------------------------------------
# translate_event: astream_events v2 -> frontend event contract
# ---------------------------------------------------------------------------

def translate_event(
    event: dict,
    worker_nodes: set[str],
    node_meta: dict[str, dict],
) -> list[dict]:
    """Map a LangGraph astream_events(v2) event to 0+ frontend events.

    Returns a list of JSON-serialisable dicts matching the existing frontend
    event contract (RUN_STARTED, AGENT_INTENT, AGENT_ACTIVITY, TASK_SUMMARY,
    TASK_HANDOFF, etc.).
    """
    kind = event.get("event", "")
    name = event.get("name", "")
    metadata = event.get("metadata", {}) or {}
    data = event.get("data", {}) or {}
    tags = event.get("tags", []) or []

    # Determine which worker node this event belongs to
    lg_node = metadata.get("langgraph_node", "")

    # Fallback: for events from nested subgraphs (create_react_agent),
    # langgraph_node refers to the inner graph's node ("agent", "tools"),
    # not the outer task_key. Use tags to identify the parent worker node.
    if lg_node not in worker_nodes:
        for tag in tags:
            if tag.startswith("worker:") and tag[7:] in worker_nodes:
                lg_node = tag[7:]
                break

    results: list[dict] = []

    # --- Worker node starts (on_chain_start where name is a worker node) ---
    if kind == "on_chain_start" and name in worker_nodes:
        meta = node_meta.get(name, {})
        agent_name = meta.get("agent_name", name)
        dep_agents = meta.get("dep_agents", [])
        role = meta.get("role", "")

        # Emit TASK_HANDOFF if this task has dependencies
        if dep_agents:
            results.append({
                "type": "TASK_HANDOFF",
                "receivingAgent": agent_name,
                "sourceAgents": dep_agents,
                "summary": f"Receiving outputs from {', '.join(dep_agents)}",
            })

        # Emit AGENT_INTENT
        results.append({
            "type": "AGENT_INTENT",
            "agentName": agent_name,
            "zone": "WORKSHOP",
            "message": f"Started working as {role.strip().lower()}." if role else f"Started working.",
        })

        return results

    # --- LLM streaming token ---
    if kind == "on_chat_model_stream" and lg_node in worker_nodes:
        meta = node_meta.get(lg_node, {})
        agent_name = meta.get("agent_name", lg_node)
        results.append({
            "type": "AGENT_ACTIVITY",
            "agentName": agent_name,
            "activity": "llm_generating",
            "details": "Thinking...",
        })
        return results

    # --- Tool starts ---
    if kind == "on_tool_start" and lg_node in worker_nodes:
        meta = node_meta.get(lg_node, {})
        agent_name = meta.get("agent_name", lg_node)
        tool_name = name or "unknown_tool"
        results.append({
            "type": "AGENT_ACTIVITY",
            "agentName": agent_name,
            "activity": "tool_call",
            "details": f"Using {tool_name}",
        })
        return results

    # --- Tool ends ---
    if kind == "on_tool_end" and lg_node in worker_nodes:
        meta = node_meta.get(lg_node, {})
        agent_name = meta.get("agent_name", lg_node)
        results.append({
            "type": "AGENT_ACTIVITY",
            "agentName": agent_name,
            "activity": "idle",
            "details": "",
        })
        return results

    # --- Worker node ends (on_chain_end where name is a worker node) ---
    if kind == "on_chain_end" and name in worker_nodes:
        meta = node_meta.get(name, {})
        agent_name = meta.get("agent_name", name)

        # Reset activity to idle
        results.append({
            "type": "AGENT_ACTIVITY",
            "agentName": agent_name,
            "activity": "idle",
            "details": "",
        })

        # Try to extract the output from the chain output
        output_data = data.get("output", {})
        full_output = ""

        if isinstance(output_data, dict):
            task_outputs = output_data.get("task_outputs", [])
            if task_outputs and isinstance(task_outputs, list):
                full_output = task_outputs[0].get("output", "")

        if full_output:
            summary = _summarize_output(full_output)
            results.append({
                "type": "TASK_SUMMARY",
                "agentName": agent_name,
                "summary": summary,
                "fullOutput": full_output,
            })

        return results

    return results


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.post("/plan-team")
def plan_team_endpoint(req: PlanTeamRequest):
    """Let the leader LLM interview the user and generate a team.

    Synchronous def (not async) so FastAPI runs it in a thread pool,
    avoiding blocking the event loop during the Anthropic API call.
    """
    history = [{"role": m.role, "content": m.content} for m in req.history]
    return plan_team(req.team_description, history)


@app.post("/run", response_model=RunResponse)
async def start_run(req: RunRequest):
    if req.mode not in ("STRICT", "BALANCED", "AUTO"):
        raise HTTPException(status_code=400, detail="mode must be 'STRICT', 'BALANCED', or 'AUTO'")

    run_id = str(uuid.uuid4())
    _pending_runs[run_id] = {"prompt": req.prompt, "mode": req.mode}
    return RunResponse(runId=run_id)


@app.get("/tools")
async def list_tools():
    return {"tools": get_available_tools()}


@app.get("/agents")
async def get_agents():
    with _yaml_lock:
        with open(AGENTS_YAML, "r") as f:
            agents_config = yaml.safe_load(f) or {}
        with open(TASKS_YAML, "r") as f:
            tasks_config = yaml.safe_load(f) or {}

    agents = []
    for agent_id, config in agents_config.items():
        role = config.get("role", "")
        if "leader" in role.lower():
            continue

        task_info = {}
        for task_key, task_config in tasks_config.items():
            if task_config.get("agent") == agent_id:
                task_info = task_config
                break

        agents.append({
            "id": agent_id,
            "role": config.get("role", "").strip(),
            "goal": config.get("goal", "").strip(),
            "backstory": config.get("backstory", "").strip(),
            "zone": "PARK",
            "task_description": task_info.get("description", "").strip() if task_info else "",
            "expected_output": task_info.get("expected_output", "").strip() if task_info else "",
            "tools": config.get("tools", []),
        })

    return {"agents": agents, "maxAgents": MAX_AGENTS}


@app.post("/agents")
async def create_agent(req: CreateAgentRequest):
    if not re.match(r"^[a-z][a-z0-9_]*$", req.agent_id):
        raise HTTPException(
            status_code=400,
            detail="agent_id must start with a lowercase letter and contain only lowercase letters, digits, and underscores",
        )

    with _yaml_lock:
        with open(AGENTS_YAML, "r") as f:
            agents_config = yaml.safe_load(f) or {}
        with open(TASKS_YAML, "r") as f:
            tasks_config = yaml.safe_load(f) or {}

        if req.agent_id in agents_config:
            raise HTTPException(status_code=400, detail="Agent ID already exists")

        if len(agents_config) >= MAX_AGENTS:
            raise HTTPException(status_code=400, detail=f"Maximum of {MAX_AGENTS} agents reached")

        invalid_tools = [t for t in req.tools if t not in TOOL_REGISTRY]
        if invalid_tools:
            raise HTTPException(status_code=400, detail=f"Unknown tool IDs: {invalid_tools}")

        agents_config[req.agent_id] = {
            "role": req.role,
            "goal": req.goal,
            "backstory": req.backstory,
            "tools": req.tools,
        }

        task_key = f"{req.agent_id}_task"
        tasks_config[task_key] = {
            "description": req.task_description,
            "expected_output": req.expected_output,
            "agent": req.agent_id,
        }

        with open(AGENTS_YAML, "w") as f:
            yaml.dump(agents_config, f, sort_keys=False, default_flow_style=False)
        with open(TASKS_YAML, "w") as f:
            yaml.dump(tasks_config, f, sort_keys=False, default_flow_style=False)

    return {
        "id": req.agent_id,
        "role": req.role,
        "goal": req.goal,
        "backstory": req.backstory,
        "zone": "PARK",
    }


@app.put("/agents/setup")
async def setup_agents(req: SetupAgentsRequest):
    """Replace all agents and tasks atomically (used during onboarding)."""
    if not req.agents:
        raise HTTPException(status_code=400, detail="At least one agent is required")

    if len(req.agents) > MAX_AGENTS:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_AGENTS} agents allowed")

    seen_ids: set[str] = set()
    for agent in req.agents:
        if not re.match(r"^[a-z][a-z0-9_]*$", agent.agent_id):
            raise HTTPException(
                status_code=400,
                detail=f"agent_id '{agent.agent_id}' must start with a lowercase letter and contain only lowercase letters, digits, and underscores",
            )
        if agent.agent_id in seen_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate agent_id: '{agent.agent_id}'")
        seen_ids.add(agent.agent_id)

        invalid_tools = [t for t in agent.tools if t not in TOOL_REGISTRY]
        if invalid_tools:
            raise HTTPException(
                status_code=400,
                detail=f"Agent '{agent.agent_id}' has unknown tool IDs: {invalid_tools}",
            )

    agents_config: dict = {}
    tasks_config: dict = {}
    response_agents = []

    for agent in req.agents:
        agents_config[agent.agent_id] = {
            "role": agent.role,
            "goal": agent.goal,
            "backstory": agent.backstory,
            "tools": agent.tools,
        }

        tasks_config[f"{agent.agent_id}_task"] = {
            "description": agent.task_description,
            "expected_output": agent.expected_output,
            "agent": agent.agent_id,
        }

        response_agents.append({
            "id": agent.agent_id,
            "role": agent.role,
            "goal": agent.goal,
            "backstory": agent.backstory,
            "zone": "PARK",
        })

    with _yaml_lock:
        with open(AGENTS_YAML, "w") as f:
            yaml.dump(agents_config, f, sort_keys=False, default_flow_style=False)
        with open(TASKS_YAML, "w") as f:
            yaml.dump(tasks_config, f, sort_keys=False, default_flow_style=False)

    return {"agents": response_agents}


# ---------------------------------------------------------------------------
# Gate resolution endpoint
# ---------------------------------------------------------------------------

@app.post("/runs/{run_id}/gates/{gate_id}")
async def resolve_gate(run_id: str, gate_id: str, req: GateResponseRequest):
    if req.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    _gate_responses[run_id] = {"action": req.action, "note": req.note}
    signal = _gate_signals.get(run_id)
    if signal:
        signal.set()
    else:
        raise HTTPException(status_code=404, detail="Gate not found or already resolved")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket — astream_events v2 streaming
# ---------------------------------------------------------------------------

@app.websocket("/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str):
    await websocket.accept()

    # 1. Pop run config
    run_config = _pending_runs.pop(run_id, None)
    if run_config is None:
        await websocket.send_text(json.dumps({"type": "ERROR", "message": "Run not found"}))
        await websocket.close()
        return

    prompt = run_config["prompt"]
    mode: GatingMode = run_config["mode"]

    try:
        # 2. Load YAML configs
        with _yaml_lock:
            with open(AGENTS_YAML, "r") as f:
                agents_config = yaml.safe_load(f) or {}
            with open(TASKS_YAML, "r") as f:
                tasks_config = yaml.safe_load(f) or {}

        # 3. Plan task delegation (CPU-bound LLM call — run in thread)
        delegation_result = await asyncio.to_thread(plan_task_delegation, prompt)

        if delegation_result["type"] == "error":
            await websocket.send_text(json.dumps({
                "type": "ERROR",
                "message": f"Delegation planning failed: {delegation_result['message']}",
            }))
            await websocket.send_text(json.dumps({"type": "RUN_FINISHED", "runId": run_id}))
            return

        delegation_plan = delegation_result["plan"]

        # 4. Build execution graph
        compiled_graph, node_meta = build_execution_graph(
            delegation_plan=delegation_plan,
            agents_config=agents_config,
            tasks_config=tasks_config,
            gating_mode=mode,
        )

        worker_nodes = set(node_meta.keys())
        _run_graphs[run_id] = compiled_graph

        # 5. Send RUN_STARTED
        await websocket.send_text(json.dumps({
            "type": "RUN_STARTED",
            "runId": run_id,
            "prompt": prompt,
        }))

        # 6. Streaming loop with interrupt/resume
        graph_input: dict | Command = {
            "prompt": prompt,
            "run_id": run_id,
            "gating_mode": mode,
            "task_outputs": [],
            "total_tasks": len(worker_nodes),
            "final_output": "",
        }
        config = {"configurable": {"thread_id": run_id}}

        while True:
            # Stream events from the graph
            async for event in compiled_graph.astream_events(
                graph_input, version="v2", config=config,
            ):
                frontend_events = translate_event(event, worker_nodes, node_meta)
                for fe in frontend_events:
                    await websocket.send_text(json.dumps(fe))

            # Check graph state after streaming completes
            state = await compiled_graph.aget_state(config)

            if not state.next:
                # Graph finished — no more nodes to run
                break

            # Graph interrupted (gate) — extract interrupt data
            # state.tasks is a tuple of PregelTask namedtuples, each with
            # an .interrupts tuple of Interrupt objects that have a .value
            interrupt_data = None
            for task in (state.tasks or ()):
                for intr in (task.interrupts or ()):
                    interrupt_data = intr.value
                    break
                if interrupt_data:
                    break

            if interrupt_data is None:
                # Fallback: check state.values for interrupt info
                # This shouldn't happen but prevents infinite loops
                break

            # Send GATE_REQUESTED to frontend
            gate_event = {
                "type": "GATE_REQUESTED",
                "gateId": interrupt_data.get("gate_id", str(uuid.uuid4())),
                "runId": run_id,
                "agentName": interrupt_data.get("agent_name", ""),
                "question": interrupt_data.get("question", ""),
                "context": interrupt_data.get("context", ""),
                "reason": interrupt_data.get("reason", ""),
                "gateSource": interrupt_data.get("gate_source", "task_complete"),
            }
            await websocket.send_text(json.dumps(gate_event))

            # Wait for gate resolution
            signal = asyncio.Event()
            _gate_signals[run_id] = signal
            await signal.wait()

            # Read response and resume the graph
            response = _gate_responses.pop(run_id, {"action": "approve", "note": ""})
            _gate_signals.pop(run_id, None)

            graph_input = Command(resume=response)

        # 7. Send RUN_FINISHED
        await websocket.send_text(json.dumps({
            "type": "RUN_FINISHED",
            "runId": run_id,
        }))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "ERROR", "message": str(e)}))
            await websocket.send_text(json.dumps({"type": "RUN_FINISHED", "runId": run_id}))
        except Exception:
            pass
    finally:
        # Cleanup
        _pending_runs.pop(run_id, None)
        _gate_signals.pop(run_id, None)
        _gate_responses.pop(run_id, None)
        _run_graphs.pop(run_id, None)
