from __future__ import annotations

import asyncio
import os
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import List
from dotenv import load_dotenv

# Load env BEFORE any LangChain imports
_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "..", ".env"))

import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .events import event_bus, gate_store, GateResponse, GatingMode
from .graph import run_graph
from .tools import get_available_tools, TOOL_REGISTRY
from .planner import plan_team

executor = ThreadPoolExecutor(max_workers=4)

_yaml_lock = threading.Lock()

AGENTS_YAML = os.path.join(_dir, "agents.yaml")
TASKS_YAML = os.path.join(_dir, "tasks.yaml")

MAX_AGENTS = 6


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    executor.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/plan-team")
def plan_team_endpoint(req: PlanTeamRequest):
    """Let the leader LLM interview the user and generate a team based on team description.

    Synchronous def (not async) so FastAPI runs it in a thread pool,
    avoiding blocking the event loop during the Anthropic API call.
    """
    history = [{"role": m.role, "content": m.content} for m in req.history]
    return plan_team(req.team_description, history)


@app.post("/run", response_model=RunResponse)
async def start_run(req: RunRequest):
    # Validate gating mode
    if req.mode not in ("STRICT", "BALANCED", "AUTO"):
        raise HTTPException(status_code=400, detail="mode must be 'STRICT', 'BALANCED', or 'AUTO'")

    run_id = str(uuid.uuid4())
    event_bus.create_run(run_id)

    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, run_graph, run_id, req.prompt, req.mode)

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
        # Skip the Leader agent (displayed separately in UI)
        role = config.get("role", "")
        if "leader" in role.lower():
            continue

        # Find the matching task for this agent
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
            "zone": "PARK",  # All agents start idle in PARK
            "task_description": task_info.get("description", "").strip() if task_info else "",
            "expected_output": task_info.get("expected_output", "").strip() if task_info else "",
            "tools": config.get("tools", []),
        })

    return {"agents": agents, "maxAgents": MAX_AGENTS}


@app.post("/agents")
async def create_agent(req: CreateAgentRequest):
    # Validate agent_id format
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

        # Check for duplicate
        if req.agent_id in agents_config:
            raise HTTPException(status_code=400, detail="Agent ID already exists")

        # Check max count
        if len(agents_config) >= MAX_AGENTS:
            raise HTTPException(status_code=400, detail=f"Maximum of {MAX_AGENTS} agents reached")

        # Validate tool IDs
        invalid_tools = [t for t in req.tools if t not in TOOL_REGISTRY]
        if invalid_tools:
            raise HTTPException(status_code=400, detail=f"Unknown tool IDs: {invalid_tools}")

        # Append to agents.yaml
        agents_config[req.agent_id] = {
            "role": req.role,
            "goal": req.goal,
            "backstory": req.backstory,
            "tools": req.tools,
        }

        # Append to tasks.yaml
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
        "zone": "PARK",  # All agents start idle in PARK
    }


@app.put("/agents/setup")
async def setup_agents(req: SetupAgentsRequest):
    """Replace all agents and tasks atomically (used during onboarding)."""
    if not req.agents:
        raise HTTPException(status_code=400, detail="At least one agent is required")

    if len(req.agents) > MAX_AGENTS:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_AGENTS} agents allowed")

    # Validate all agent IDs upfront
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

        # Validate tool IDs
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
            "zone": "PARK",  # All agents start idle in PARK
        })

    # Write atomically — "w" mode replaces the entire file
    with _yaml_lock:
        with open(AGENTS_YAML, "w") as f:
            yaml.dump(agents_config, f, sort_keys=False, default_flow_style=False)
        with open(TASKS_YAML, "w") as f:
            yaml.dump(tasks_config, f, sort_keys=False, default_flow_style=False)

    return {"agents": response_agents}


@app.post("/runs/{run_id}/gates/{gate_id}")
async def resolve_gate(run_id: str, gate_id: str, req: GateResponseRequest):
    if req.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    response = GateResponse(action=req.action, note=req.note)
    ok = gate_store.resolve_gate(run_id, gate_id, response)
    if not ok:
        raise HTTPException(status_code=404, detail="Gate not found")
    return {"status": "ok"}


@app.websocket("/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str):
    await websocket.accept()

    queue = event_bus.get_queue(run_id)
    if queue is None:
        await websocket.send_text('{"type":"ERROR","message":"Run not found"}')
        await websocket.close()
        return

    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=0.5)
                await websocket.send_text(msg)

                # Check if run finished
                if '"RUN_FINISHED"' in msg:
                    break
            except asyncio.TimeoutError:
                # Send a ping to keep connection alive
                continue
    except WebSocketDisconnect:
        pass
    finally:
        event_bus.cleanup(run_id)
