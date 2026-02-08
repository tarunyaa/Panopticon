# Panopticon — LangGraph Migration Plan

**Date:** February 8, 2026
**Branch:** phase-3
**Goal:** Replace the hand-rolled asyncio orchestration with idiomatic LangGraph patterns,
delivering the five core features below.

---

## Features

### Feature 1: Automatic Team Creation via Leader Interview

> The lead agent automatically creates a team of agents based on the team description
> provided by the user. The lead agent can ask questions to the user to create a team
> of agents and their roles, specialities, tool access according to rules in
> `backend/leader_rules.md`.

**Critique: Already implemented. Needs refinement, not a rewrite.**

This feature is fully functional today. `planner.py:plan_team()` drives a multi-turn
conversation where the Leader LLM (via `ChatAnthropic` + `bind_tools`) asks 4-8
questions using the `ask_question` tool, then calls `create_team_files` to write
`agents.yaml` + `tasks.yaml`. The system prompt is loaded from `leader_rules.md`.
The frontend calls `POST /plan-team` in a loop, passing accumulated history.

What works well:
- The interview loop, tool-calling pattern, and YAML generation are solid
- `leader_rules.md` is thorough (interview protocol, team composition rules, tooling
  constraints, quality checks)
- The `create_team_files` tool validates agent count, tool IDs, `{prompt}` placeholders,
  and Leader presence

What should improve:
- `plan_team()` uses `bind_tools` which means the LLM can *choose* not to call a tool.
  When it doesn't, the code has a fragile fallback that searches the text for a question
  mark (lines 350-361). Use `with_structured_output` to guarantee structured responses.
- No retry on validation failure — if `create_team_files` returns an error string, the
  error is returned to the frontend but the LLM never sees it. It should re-invoke with
  the error so the LLM can self-correct.

**Implementation: Phase D3** (minor planner improvements). No architectural change needed.

---

### Feature 2: Automatic Task Delegation with Parallel Execution

> The lead agent efficiently and automatically delegates tasks across the team of agents.
> Parallel and quick execution.

**Critique: Functional but poorly implemented. This is the core of the rewrite.**

The delegation pipeline has two stages, both of which work but are built wrong:

**Stage 1 — Delegation planning** (`planner.py:plan_task_delegation()`): The Leader LLM
analyzes the user's task, considers the team's capabilities, and outputs a dependency
DAG via the `create_delegation_plan` tool. This writes `delegation_plan.yaml` with
`task_key`, `dependencies`, and `async_execution` fields. This stage is fine — it
correctly uses `bind_tools` for structured output and the delegation rules in
`delegation_rules.md` are thorough.

**Stage 2 — Execution** (`graph.py`): This is where things go wrong. The entire
execution engine is a hand-rolled asyncio orchestrator that reimplements what LangGraph
provides out of the box:

| What it does manually | What LangGraph provides |
|----------------------|------------------------|
| `_topological_levels()` — DAG sort | Automatic from graph edges |
| `asyncio.gather()` — parallel execution | `Send` fan-out |
| `_run_worker()` — tool-calling loop | `create_react_agent` |
| `context_results` dict — context passing | `StateGraph` state + reducers |
| Double event loop hack | Native async `ainvoke()`/`astream()` |

The manual approach is ~500 lines of fragile code. The race condition on
`context_results` (shared dict written by parallel coroutines) hasn't bitten yet
only because the current tasks don't produce conflicting keys.

**Implementation: Phase A** (the entire graph.py rewrite). This is the highest-priority
phase — it replaces the execution engine with a proper `StateGraph` where:
- Each worker is a `create_react_agent` node
- The DAG from `delegation_plan.yaml` becomes graph edges
- Parallel tasks are expressed via `Send` fan-out
- Context flows through typed state with reducers

---

### Feature 3: High Quality Output

> High quality output.

**Critique: This is not a feature. It's an emergent property of the other features.**

"High quality output" cannot be implemented as a discrete component. It's the result of:

1. **Good agent prompts** — Already handled by `leader_rules.md` which requires explicit
   `expected_output` fields and non-overlapping roles. Quality here depends on the
   Leader LLM's interview quality, not on code changes.

2. **Proper context passing** — Currently broken. Context between agents is concatenated
   strings. When the researcher's output is passed to the writer, it's dumped as a raw
   text block. With LangGraph state, context can be structured (typed dicts with specific
   fields) so downstream agents receive clean, organized input.

3. **Final synthesis** — Currently `graph.py` lines 461-486 run an extra LLM call to
   combine all outputs when there are multiple tasks. This is reasonable but ham-fisted:
   it concatenates all outputs and asks a fresh LLM to "synthesize." With LangGraph, the
   final node in the graph naturally receives accumulated state from all predecessors,
   making synthesis a graph node rather than a post-hoc hack.

4. **Tool quality** — `tools.py` web_scraper does naive regex HTML stripping. The
   web_search returns raw Serper snippets. These could be improved but are independent
   of the architecture migration.

What actually moves the needle on output quality:
- **Phase A** fixes context passing (structured state > string concatenation)
- **Phase A** fixes the synthesis step (graph node > post-hoc hack)
- **Phase C** enables human feedback loops (user can reject and request revision)
- **leader_rules.md** already enforces quality constraints at the team design level

No dedicated "quality" phase is needed. Don't build a "quality module" — improve
the pipeline that already determines quality.

---

### Feature 4: User Approval Gates Based on Gating Level

> User can provide approval when needed, based on gating level.

**Critique: Already implemented. Needs a better backend mechanism, not a redesign.**

The gate system is fully functional across all three modes defined in `gating_rules.md`:

| Mode | Behavior |
|------|----------|
| STRICT | Gate after every agent task (except last) |
| BALANCED | Gate on final deliverable + leader requests |
| AUTO | Gate on final deliverable + leader requests only |

The policy logic in `gate_policy.py` is clean and correct. The problem is entirely in
the *mechanism* — how gates block and resume execution:

**Current mechanism** (broken):
- `GateStore` creates a `threading.Event`
- `_run_worker` calls `gate_event.wait(600)` — blocks a thread for up to 10 minutes
- The REST endpoint calls `gate_store.resolve_gate()` which sets the event
- No persistence — server restart kills the run
- No crash recovery — gate state is in-memory only

**LangGraph mechanism** (correct):
- `interrupt()` pauses the graph and persists state via checkpointer
- REST endpoint calls `graph.ainvoke(Command(resume=...))` to continue
- State survives server restarts (with `SqliteSaver` or `PostgresSaver`)
- No threads blocked — the graph simply isn't running until resumed

The hard rules from `gating_rules.md` (always gate file_writer and terminal operations)
are partially implemented in `gate_policy.py:should_gate_tool_call()` but **never
actually called** — the current code only gates after task completion, not before tool
execution. This is a gap.

**Implementation: Phase C** replaces the blocking mechanism with `interrupt()` +
checkpointer. The gate policy logic (`should_gate_task_complete`,
`should_gate_tool_call`) stays as-is — it's good code in the wrong plumbing.

To close the tool-gating gap, Phase C should also add `interrupt()` calls inside the
tool execution node (or use a custom `ToolNode` wrapper) that checks
`should_gate_tool_call()` before running file_writer or terminal tools:

```python
def gated_tool_node(state: PanopticonState) -> dict:
    tool_call = state["pending_tool"]
    should_gate, reason = should_gate_tool_call(
        mode=state["gating_mode"],
        tool_name=tool_call["name"],
    )
    if should_gate:
        decision = interrupt({
            "type": "GATE_REQUESTED",
            "question": f"Allow {tool_call['name']}?",
            "context": str(tool_call["args"]),
            "reason": reason,
            "gateSource": "tool_call",
        })
        if decision.get("action") == "reject":
            return {"messages": [ToolMessage(content="User rejected this operation.")]}
    # Execute the tool
    return execute_tool(tool_call)
```

---

### Feature 5: Agent Observability (Task Completion Status)

> Observability into agents such as their task completion status.

**Critique: Partially implemented. Needs the streaming rewrite to do properly.**

Current observability is decent but incomplete:

| What works | What's missing |
|-----------|---------------|
| `AGENT_INTENT` events (agent started) | No % progress or ETA |
| `AGENT_ACTIVITY` events (tool calls, LLM generating) | No token-level streaming to UI |
| `TASK_SUMMARY` events (agent finished) | No intermediate output previews |
| `TASK_HANDOFF` events (context passing) | No dependency graph visualization data |

The `ActivityTracker` callback handler emits `AGENT_ACTIVITY` events for `tool_call`,
`llm_generating`, and `idle` states. This gives the frontend enough to show spinner
states and tool usage, but it's a pull-based system (polling a queue at 500ms intervals)
that adds latency.

**Implementation: Phase B** is where this gets dramatically better. `astream_events`
with `version="v2"` provides every event the frontend could want:

| `astream_events` event | Maps to frontend event | What it enables |
|------------------------|----------------------|-----------------|
| `on_chain_start` (agent node) | `AGENT_INTENT` | Agent started working |
| `on_chat_model_stream` | `AGENT_ACTIVITY` (streaming) | Real-time "thinking" indicator, token-level output preview |
| `on_tool_start` | `AGENT_ACTIVITY` (tool_call) | Which tool, what arguments |
| `on_tool_end` | `AGENT_ACTIVITY` (idle) | Tool result available |
| `on_chain_end` (agent node) | `TASK_SUMMARY` | Agent finished, full output |
| `__interrupt__` | `GATE_REQUESTED` | Gate pending |

The translation layer (Phase B2) maps these to the existing frontend event contract.
No new frontend event types needed — the existing `AGENT_INTENT`, `AGENT_ACTIVITY`,
`TASK_SUMMARY` types already cover all the states.

For richer observability (dependency graph, % progress), extend the `PanopticonState`
with tracking fields:

```python
class PanopticonState(TypedDict):
    ...
    completed_tasks: Annotated[list[str], add]   # Task keys that are done
    # Frontend can compute: progress = len(completed_tasks) / total_tasks
```

The `on_chain_end` handler in the translation layer appends to `completed_tasks`,
and the frontend receives a `TASK_SUMMARY` event with the updated count — enough
to render a progress bar.

---

### Future Feature: Runtime User Intervention and Feedback

> User ability to intervene into agent actions and provide them runtime feedback.

**Critique: This is the hardest feature and the one most worth building. But it
requires Phase C (interrupt system) to be done first.**

There are two levels of intervention:

**Level 1: Post-task feedback (Phase C gives this for free)**

After any agent completes, the user can reject and provide a note. The `approval_gate`
node injects the note as a `HumanMessage` into the graph state, and the next agent (or
a re-run of the same agent) receives it. This is already described in Phase C2.

**Level 2: Mid-task intervention (requires additional work)**

The user interrupts an agent *while it's working* — e.g., "stop researching X, focus
on Y instead." This is harder because `create_react_agent` runs as a subgraph and
doesn't expose mid-execution interrupt points by default.

Implementation approach:
1. Use `interrupt_before=["tools"]` when compiling each worker's ReAct agent subgraph.
   This pauses before every tool call, allowing the user to approve, reject, or redirect.
2. In AUTO/BALANCED modes, only interrupt before dangerous tools (file_writer, terminal)
   — the `should_gate_tool_call()` function already has this logic.
3. In a future "INTERACTIVE" mode, interrupt before every tool call, giving the user
   full control.

The WebSocket handler would need bidirectional communication — the frontend sends
intervention messages that the backend translates into `Command(resume=...)` calls:

```python
# Frontend sends:  {"type": "INTERVENE", "message": "Focus on Python, not Java"}
# Backend does:
graph.update_state(config, {
    "messages": [HumanMessage(content="[User intervention]: Focus on Python, not Java")]
})
result = await graph.ainvoke(Command(resume="continue"), config=config)
```

`graph.update_state()` modifies the persisted state directly, and
`Command(resume=...)` continues execution with the injected feedback. This is a
native LangGraph pattern — no custom plumbing needed.

**Implementation: After Phases A-C are done.** This feature depends on the checkpointer
(Phase C) for `update_state`, and on native streaming (Phase B) for the bidirectional
WebSocket. It should not be attempted until the foundation is in place.

---

## How Features Map to Phases

| Feature | Phase | Work Required |
|---------|-------|---------------|
| 1. Team creation via Leader interview | D3 (minor) | Already works. Improve with `with_structured_output` and retry on validation error. |
| 2. Automatic parallel delegation | **A** (major) | Core rewrite. Replace manual orchestrator with `StateGraph` + `create_react_agent`. |
| 3. High quality output | A + C | Not a feature. Improved by structured context passing (A) and human feedback loops (C). |
| 4. Approval gates by gating level | **C** (major) | Replace `GateStore` + threading with `interrupt()` + checkpointer. Add tool-level gating. |
| 5. Agent observability | **B** (major) | Replace EventBus with `astream_events`. Translation layer maps to existing frontend events. |
| Future: Runtime intervention | Post-C | Requires checkpointer + `update_state`. Build after A-C foundation. |

---

## Current State (What We Have)

The backend was ported from CrewAI to LangChain/LangGraph primitives (`ChatAnthropic`,
`@tool`, `bind_tools`), but **LangGraph's orchestration framework is not used at all.**
Instead, `graph.py` reimplements agent scheduling, tool-calling loops, context passing,
and event streaming manually with raw asyncio — roughly 500 lines doing what ~50 lines
of LangGraph would do.

### Problems

| Area | Issue |
|------|-------|
| `graph.py` | No `StateGraph`. Manual topological sort, manual tool-calling loop, manual `asyncio.gather` for parallelism, string-concatenated context passing. |
| `main.py` | Double event-loop: `run_in_executor` dispatches to a thread that creates its _own_ `asyncio.new_event_loop()`. |
| `events.py` | Custom `EventBus` (asyncio.Queue) polled at 500ms intervals in the WebSocket handler. Events cross thread/loop boundaries. |
| `events.py` | `GateStore` uses `threading.Event.wait(600)` — blocks a thread for up to 10 min, no persistence, no crash recovery. |
| `activity_callbacks.py` | Synchronous `BaseCallbackHandler` in async code. |
| `crew.py` | Dead code — 388 lines of CrewAI logic no longer imported by anything. |
| `zone_infer.py` | Never imported. All agents hardcoded to `zone="WORKSHOP"`. |

---

## Phase A — Real StateGraph with `create_react_agent` Workers

**Impact:** Eliminates ~700 lines. Replaces the entire manual orchestration in `graph.py`.

### What changes

Replace `graph.py` with a proper LangGraph `StateGraph` where each worker agent is a
`create_react_agent` node and the execution DAG is expressed as graph edges.

### A1. Define typed graph state

Instead of passing context between agents via a plain `dict[str, str]` of concatenated
strings, define a proper `TypedDict` state with reducers:

```python
from typing import Annotated, TypedDict
from langgraph.graph import add_messages
from operator import add

class PanopticonState(TypedDict):
    messages: Annotated[list, add_messages]   # LangGraph message accumulator
    run_id: str                               # Unique run identifier
    prompt: str                               # Original user prompt
    gating_mode: str                          # "STRICT" | "BALANCED" | "AUTO"
    task_outputs: Annotated[list[dict], add]   # {agent_key: output} from each worker
    current_agent: str                        # Name of currently executing agent
    task_index: int                           # Index of current task (for gate logic)
    total_tasks: int                          # Total tasks in the plan
```

The `add_messages` reducer automatically handles message deduplication by ID and
appends new messages. The `add` reducer on `task_outputs` concatenates lists so
parallel workers' results are merged without overwriting.

**Why this matters:** The current `context_results` dict in `_run_graph_async` is a
flat dict passed by reference. When two workers run in parallel via `asyncio.gather`,
they both read from and write to this dict — a race condition waiting to happen.
LangGraph state with reducers handles concurrent updates correctly.

### A2. Replace `_run_worker` with `create_react_agent`

The current `_run_worker` function (lines 134-334 of `graph.py`) manually implements
the ReAct agent loop:

```python
# CURRENT: 100+ lines of manual loop
for _ in range(max_iterations):
    response = await llm_with_tools.ainvoke(messages)
    messages.append(response)
    if not response.tool_calls:
        break
    for tool_call in response.tool_calls:
        tool_result = await asyncio.to_thread(t.invoke, tool_call["args"])
        messages.append(ToolMessage(content=str(tool_result), tool_call_id=...))
```

Replace with LangGraph's prebuilt ReAct agent:

```python
from langgraph.prebuilt import create_react_agent

# REPLACEMENT: 3 lines
def build_worker(agent_config: dict, tools: list) -> CompiledGraph:
    return create_react_agent(
        model=ChatAnthropic(model=_MODEL),
        tools=tools,
        prompt=build_system_prompt(agent_config),
    )
```

`create_react_agent` returns a compiled subgraph that handles the full tool-calling
loop internally — including error recovery, parallel tool execution, and proper
message threading. It can be added directly as a node in the parent graph:

```python
builder.add_node("researcher", build_worker(researcher_config, researcher_tools))
```

**What gets deleted:**
- The entire `_run_worker` function (~200 lines)
- The `max_iterations` loop
- Manual `ToolMessage` construction
- `asyncio.to_thread(t.invoke, ...)` calls (LangChain tools support `ainvoke` natively)
- Manual tool lookup by name

### A3. Replace topological sort + asyncio.gather with graph structure

The current `_topological_levels()` function (lines 84-126) computes a DAG ordering
manually, then `_run_graph_async` uses `asyncio.gather()` to run each level in parallel.

In LangGraph, parallel execution is expressed structurally using `Send`:

```python
from langgraph.types import Send

def dispatch_parallel_tasks(state: PanopticonState) -> list[Send]:
    """Fan out to all tasks that have no unmet dependencies."""
    runnable = get_next_runnable_tasks(state)
    return [
        Send(task.agent_key, {**state, "current_task": task})
        for task in runnable
    ]
```

LangGraph automatically runs all `Send` targets in parallel and collects results
using the state reducers. No manual gather, no manual level computation.

For the dynamic DAG (where the delegation plan determines which agents run in what
order), the graph is built dynamically at runtime from the delegation plan YAML:

```python
def build_execution_graph(delegation_plan: dict, agents_config: dict, tasks_config: dict):
    builder = StateGraph(PanopticonState)

    # Add a node for each worker
    for task_entry in delegation_plan["tasks"]:
        task_key = task_entry["task_key"]
        agent_key = tasks_config[task_key]["agent"]
        agent_cfg = agents_config[agent_key]
        tools = instantiate_tools(agent_cfg.get("tools", []))
        builder.add_node(task_key, build_worker(agent_cfg, tools))

    # Add edges from delegation plan dependencies
    roots = []
    for task_entry in delegation_plan["tasks"]:
        deps = task_entry.get("dependencies", [])
        if not deps:
            roots.append(task_entry["task_key"])
        for dep in deps:
            builder.add_edge(dep, task_entry["task_key"])

    # Fan out from START to all root tasks
    if len(roots) == 1:
        builder.add_edge(START, roots[0])
    else:
        # Multiple roots = parallel start
        builder.add_conditional_edges(START, lambda _: roots)

    # Find terminal tasks (no one depends on them) -> END
    all_deps = {d for t in delegation_plan["tasks"] for d in t.get("dependencies", [])}
    all_keys = {t["task_key"] for t in delegation_plan["tasks"]}
    terminals = all_keys - all_deps
    for t in terminals:
        builder.add_edge(t, END)

    return builder.compile()
```

**What gets deleted:**
- `_topological_levels()` (~45 lines)
- The level-by-level `asyncio.gather` loop (~30 lines)
- The `context_results` dict and all string-concatenation context passing

### A4. Delete `crew.py`

`crew.py` (388 lines) imports `crewai` and implements the old CrewAI execution engine.
`main.py` already imports `run_graph` from `graph.py`, not `run_crew` from `crew.py`.
This file is dead code.

**Action:** Delete `backend/crew.py`.

### Files affected

| File | Action |
|------|--------|
| `backend/graph.py` | Rewrite (~500 lines -> ~100 lines) |
| `backend/crew.py` | Delete |

---

## Phase B — Native Streaming via `astream_events`

**Impact:** Eliminates the custom EventBus, thread pool, and queue-polling WebSocket handler.

### What changes

Replace the `EventBus` + `ThreadPoolExecutor` + `asyncio.Queue` architecture with
LangGraph's native `astream_events(version="v2")`, piped directly into the WebSocket.

### B1. Remove the thread pool dispatch pattern

Current architecture in `main.py`:

```python
# CURRENT: main.py lines 113-125
executor = ThreadPoolExecutor(max_workers=4)

@app.post("/run")
async def start_run(req: RunRequest):
    run_id = str(uuid.uuid4())
    event_bus.create_run(run_id)
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, run_graph, run_id, req.prompt, req.mode)
    return RunResponse(runId=run_id)
```

Then `run_graph` creates its own event loop in the thread (`asyncio.new_event_loop()`).
This double-loop pattern is fragile and breaks native async streaming.

**Replacement:** The graph runs directly in the async WebSocket handler. The `/run`
endpoint stores the run config; the WebSocket handler executes the graph:

```python
# REPLACEMENT
_pending_runs: dict[str, dict] = {}

@app.post("/run")
async def start_run(req: RunRequest):
    run_id = str(uuid.uuid4())
    _pending_runs[run_id] = {"prompt": req.prompt, "mode": req.mode}
    return RunResponse(runId=run_id)

@app.websocket("/runs/{run_id}")
async def run_ws(websocket: WebSocket, run_id: str):
    await websocket.accept()
    run_config = _pending_runs.pop(run_id, None)
    if not run_config:
        await websocket.send_json({"type": "ERROR", "message": "Run not found"})
        await websocket.close()
        return

    graph = build_execution_graph(...)  # from Phase A
    config = {"configurable": {"thread_id": run_id}}

    async for event in graph.astream_events(
        {"messages": [HumanMessage(content=run_config["prompt"])]},
        version="v2",
        config=config,
    ):
        ws_event = translate_event(event)
        if ws_event:
            await websocket.send_json(ws_event)
```

### B2. Event translation layer

The frontend expects specific event types (`AGENT_INTENT`, `TASK_SUMMARY`,
`AGENT_ACTIVITY`, etc.). Write a thin translation layer that maps `astream_events`
event types to the existing frontend contract:

```python
def translate_event(event: dict) -> dict | None:
    """Map LangGraph astream_events to Panopticon frontend events."""
    kind = event["event"]

    if kind == "on_chain_start" and event["name"] in agent_node_names:
        return {
            "type": "AGENT_INTENT",
            "agentName": event["name"],
            "zone": infer_zone(...),    # Wire in zone_infer.py
            "message": f"Started working.",
        }

    if kind == "on_chat_model_stream":
        return {
            "type": "AGENT_ACTIVITY",
            "agentName": extract_agent_name(event),
            "activity": "llm_generating",
            "details": "Thinking...",
        }

    if kind == "on_tool_start":
        return {
            "type": "AGENT_ACTIVITY",
            "agentName": extract_agent_name(event),
            "activity": "tool_call",
            "details": f"Using {event['name']}",
        }

    if kind == "on_chain_end" and event["name"] in agent_node_names:
        output = extract_final_output(event)
        return {
            "type": "TASK_SUMMARY",
            "agentName": event["name"],
            "summary": summarize(output),
            "fullOutput": output,
        }

    return None  # Skip events the frontend doesn't care about
```

**Key point:** The frontend event contract stays exactly the same. Only the backend
plumbing changes. No frontend modifications needed.

### B3. Remove EventBus and queue infrastructure

With `astream_events` handling all event delivery, the following become unnecessary:

- `EventBus` class and its `asyncio.Queue` per run
- `event_bus.create_run()` / `event_bus.emit()` / `event_bus.cleanup()`
- The `ThreadPoolExecutor` in `main.py`
- The `wait_for(queue.get(), timeout=0.5)` polling loop in the WebSocket handler

The `events.py` file shrinks to just the dataclass definitions (for the translation
layer) and the `GateStore` (which Phase C will address).

### B4. Convert `ActivityTracker` to `AsyncCallbackHandler`

If `astream_events` provides all the granularity needed (it does — `on_llm_start`,
`on_tool_start`, `on_tool_end` are all available), the `ActivityTracker` callback
handler can be removed entirely. The translation layer in B2 replaces it.

If custom events beyond what `astream_events` provides are needed, convert
`ActivityTracker` from `BaseCallbackHandler` to `AsyncCallbackHandler`:

```python
from langchain_core.callbacks import AsyncCallbackHandler

class AsyncActivityTracker(AsyncCallbackHandler):
    async def on_llm_start(self, serialized, prompts, **kwargs):
        # Non-blocking
        ...
```

### Files affected

| File | Action |
|------|--------|
| `backend/main.py` | Rewrite WebSocket handler and `/run` endpoint |
| `backend/events.py` | Remove `EventBus` class. Keep dataclass definitions and `GateStore` (for now). |
| `backend/activity_callbacks.py` | Delete (or convert to async if custom events needed) |

---

## Phase C — Native Human-in-the-Loop via `interrupt()`

**Impact:** Eliminates the thread-blocking gate system. Adds crash recovery and state persistence.

### What changes

Replace the `GateStore` + `threading.Event` blocking mechanism with LangGraph's native
`interrupt()` function and a checkpointer backend.

### C1. Add a checkpointer

The checkpointer persists the full graph state (including where execution paused) so
that runs survive server restarts and gates don't block threads.

```python
from langgraph.checkpoint.memory import MemorySaver

# Development
checkpointer = MemorySaver()

# Production (future)
# from langgraph.checkpoint.sqlite import SqliteSaver
# checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
```

The graph is compiled with the checkpointer:

```python
graph = builder.compile(checkpointer=checkpointer)
```

Every invocation requires a `thread_id` in the config:

```python
config = {"configurable": {"thread_id": run_id}}
result = await graph.ainvoke(input_data, config=config)
```

### C2. Add an `approval_gate` node using `interrupt()`

Instead of blocking a thread with `threading.Event.wait(600)`, use LangGraph's
`interrupt()` which pauses graph execution, persists state, and returns control
to the caller:

```python
from langgraph.types import interrupt

def approval_gate(state: PanopticonState) -> dict:
    """Conditionally pause for human approval."""
    mode = state["gating_mode"]
    is_last = state["task_index"] == state["total_tasks"] - 1

    should_gate, reason = should_gate_task_complete(
        mode=mode,
        is_last_task=is_last,
        leader_recommended=False,
    )

    if not should_gate:
        return {}  # Pass through, no interruption

    agent_name = state["current_agent"]
    last_output = state["messages"][-1].content

    # This pauses the graph and returns to the caller.
    # Execution resumes HERE when the caller invokes Command(resume=...).
    decision = interrupt({
        "type": "GATE_REQUESTED",
        "question": "Final deliverable ready. Approve?" if is_last
                    else f"{agent_name} finished their task. Continue?",
        "agentName": agent_name,
        "context": last_output[:200],
        "reason": reason,
    })

    # Execution resumes here with the human's response
    if decision.get("action") == "reject":
        raise RuntimeError(f"Run rejected by user at {agent_name}'s gate")

    # If user provided feedback, inject it into messages for the next agent
    if decision.get("note"):
        return {
            "messages": [HumanMessage(content=f"[Human feedback]: {decision['note']}")]
        }

    return {}
```

The gate node is inserted between worker nodes in the graph:

```python
# After each worker, route through the gate
builder.add_edge("researcher_task", "gate_after_researcher")
builder.add_node("gate_after_researcher", approval_gate)
builder.add_edge("gate_after_researcher", "writer_task")
```

### C3. Replace the gate REST endpoint

The current endpoint calls `gate_store.resolve_gate()` which sets a `threading.Event`.
Replace with LangGraph's `Command(resume=...)`:

```python
from langgraph.types import Command

@app.post("/runs/{run_id}/gates/{gate_id}")
async def resolve_gate(run_id: str, gate_id: str, req: GateResponseRequest):
    config = {"configurable": {"thread_id": run_id}}

    # Resume the paused graph with the human's decision
    result = await graph.ainvoke(
        Command(resume={"action": req.action, "note": req.note}),
        config=config,
    )

    return {"status": "ok"}
```

Note: `gate_id` becomes vestigial since the checkpointer tracks which interrupt is
pending. The endpoint signature can stay the same for frontend compatibility, but
the `gate_id` parameter is ignored — only `thread_id` (= `run_id`) matters.

When the graph is resumed, `interrupt()` returns the value passed to `Command(resume=...)`,
and execution continues from where it left off. No thread was blocked. The state was
persisted. If the server restarted between the gate request and the response, the
graph can still be resumed.

### C4. Delete GateStore and threading infrastructure

With `interrupt()` + checkpointer handling gate persistence and resumption:

- Delete `GateStore` class from `events.py`
- Delete `gate_store` singleton
- Delete `threading.Event` usage
- Delete `gate_store.cleanup(run_id)` calls
- Keep `gate_policy.py` — `should_gate_task_complete()` is still used by the
  `approval_gate` node to decide whether to interrupt

### How it behaves at runtime

1. Graph runs worker nodes. After a worker completes, execution enters `approval_gate`.
2. `approval_gate` checks gate policy. If no gate needed, returns `{}` and the graph
   continues to the next node.
3. If gate needed, `interrupt({...})` pauses execution. The checkpointer saves state.
   The `astream_events` iterator yields an `__interrupt__` event.
4. The WebSocket handler translates this into a `GATE_REQUESTED` event for the frontend.
5. The user clicks Approve/Reject in the UI. Frontend POSTs to `/runs/{id}/gates/{id}`.
6. The endpoint calls `graph.ainvoke(Command(resume=...), config)`.
7. `interrupt()` returns the resume value. `approval_gate` processes it and returns.
8. The graph continues to the next worker node. Streaming resumes.

### Files affected

| File | Action |
|------|--------|
| `backend/graph.py` | Add `approval_gate` node, compile with checkpointer |
| `backend/events.py` | Delete `GateStore` class and `gate_store` singleton |
| `backend/main.py` | Rewrite gate endpoint to use `Command(resume=...)` |
| `backend/gate_policy.py` | Keep as-is (still provides the decision logic) |

---

## Phase D — Cleanup and Polish

**Impact:** Removes dead code, wires up unused modules, updates stale documentation.

### D1. Delete dead CrewAI code

| File | Reason |
|------|--------|
| `backend/crew.py` | Old CrewAI engine, replaced by `graph.py`. Not imported anywhere. |
| `backend/test_full_crew.py` | Tests for CrewAI-based crew. |
| `backend/test_delegation.py` | Tests referencing old delegation flow. |
| `backend/test_basic_functionality.py` | References CrewAI imports. |
| `backend/test_end_to_end.py` | E2E test for old architecture. |
| `backend/test_e2e_flow.py` | Duplicate E2E test. |
| `backend/test_model.py` | CrewAI model smoke test. |

Review each test file — keep tests that validate LangChain-era logic, delete those
that import or reference `crewai`.

### D2. Wire `zone_infer.py` into agent nodes

`zone_infer.py` implements keyword-based zone inference (HOUSE, WORKSHOP, CAFE, PARK)
but is never imported. Currently every agent is hardcoded to `zone="WORKSHOP"` in
`graph.py:167`.

In the Phase B translation layer, use `infer_zone()` to set the correct zone when
emitting `AGENT_INTENT` events:

```python
from .zone_infer import infer_zone

zone = infer_zone(
    role=agent_config["role"],
    goal=agent_config["goal"],
    backstory=agent_config["backstory"],
    task_description=task_config["description"],
)
```

This makes the pixel-art village actually reflect what agents are doing — researchers
go to WORKSHOP, writers go to CAFE, planners go to HOUSE.

### D3. Use `with_structured_output` in `plan_task_delegation`

The delegation planner in `planner.py` uses `bind_tools` + `create_delegation_plan`
to get structured output. This works but has a fallback path (line 473) for when
the LLM doesn't call the tool:

```python
# CURRENT fallback
return {"type": "error", "message": "Leader did not create a delegation plan"}
```

Replace with `with_structured_output` which guarantees the response conforms to
the schema:

```python
structured_llm = llm.with_structured_output(CreateDelegationPlanInput)
plan: CreateDelegationPlanInput = structured_llm.invoke(messages)
```

This eliminates the fallback path entirely — every call returns a valid
`CreateDelegationPlanInput` object.

### D4. Update `docs/summary.md`

The summary still references CrewAI in multiple places:

- Tech stack says "CrewAI" — should say "LangChain + LangGraph"
- Key files lists `crew.py` — should list `graph.py`
- The delegation system references `async_execution` flag (a CrewAI concept) —
  should reference LangGraph `Send` / parallel edges

### D5. Clean up the `panopticon/` directory

The `panopticon/` directory at project root is a stale CrewAI scaffold (generated by
`crewai create`). It contains unused `__init__.py`, `config/`, and `crew.py` files
that are not part of the actual application. Delete the entire directory.

### Files affected

| File | Action |
|------|--------|
| `backend/crew.py` | Delete |
| `backend/test_*.py` (CrewAI ones) | Delete or rewrite |
| `backend/graph.py` | Wire `zone_infer.py` |
| `backend/planner.py` | Use `with_structured_output` |
| `docs/summary.md` | Update references |
| `panopticon/` | Delete directory |

---

## Execution Order

Phases should be executed in order (A -> B -> C -> D) because each builds on the previous:

1. **Phase A** must come first — it creates the `StateGraph` that Phases B and C depend on.
2. **Phase B** requires the compiled graph from Phase A to call `astream_events` on.
3. **Phase C** requires the compiled graph from Phase A to add the checkpointer and interrupt nodes.
4. **Phase D** is cleanup that can happen at any time but is cleanest after A-C are done.

### Net impact

| Phase | Lines Removed | Lines Added | Net |
|-------|:---:|:---:|:---:|
| A — StateGraph + create_react_agent | ~500 | ~100 | -400 |
| B — astream_events streaming | ~100 | ~40 | -60 |
| C — interrupt() gates | ~80 | ~30 | -50 |
| D — Cleanup | ~400 | ~10 | -390 |
| **Total** | **~1080** | **~180** | **~-900** |

The codebase shrinks by roughly 900 lines while gaining: proper async execution,
crash-recoverable gates, native streaming, parallel agent execution via graph
structure, and elimination of all thread-pool / double-event-loop hacks.
The frontend event contract remains unchanged — no frontend modifications needed.
