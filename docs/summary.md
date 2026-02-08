# Panopticon — Complete Feature Summary

**Last Updated:** February 8, 2026
**Status:** Fully Functional with Parallel Task Execution

---

## What is Panopticon?

An AI agent orchestration system with real-time visualization. Watch teams of 3-4 AI agents collaborate on tasks in a pixel-art village while they research, strategize, and create content in parallel.

**Tech Stack:** React + Phaser 3 + FastAPI + LangChain + LangGraph + Claude Sonnet 4.5

---

## Core Features

### 1. Three-Phase Workflow

**Phase 1: Team Building**
- Interactive Leader agent interview (up to 8 questions)
- Pre-built templates: Development, Content, Research
- Custom team creation via ChatAnthropic with tool calling
- Outputs: agents.yaml + tasks.yaml

**Phase 2: Delegation Planning**
- Leader analyzes user task via `with_structured_output`
- Identifies parallel execution opportunities
- Creates optimized execution plan
- Outputs: delegation_plan.yaml with dependencies

**Phase 3: Task Execution**
- LangGraph StateGraph with dynamic worker nodes
- Parallel fan-out / fan-in via graph edge semantics
- Real-time WebSocket event streaming via `astream_events(v2)`
- Context passing between dependent tasks

### 2. Parallel Task Execution

LangGraph's StateGraph natively handles parallelism — tasks with no dependencies
fan out from START and run concurrently, converging at a synthesize node.

**Content Team:** Research + Strategy in parallel -> Writing (33% faster)
**Development Team:** Requirements + Tech Research in parallel -> Design -> Dev (25% faster)
**Research Team:** Primary + Critical Analysis in parallel -> Synthesis (33% faster)

### 3. Team Templates

**Development (4 agents):** Requirements Analyst, Technical Researcher, System Designer, Lead Developer
**Content (3 agents):** Topic Researcher, Content Strategist, Senior Writer
**Research (3 agents):** Primary Researcher, Critical Analyst, Report Synthesizer

### 4. Visual Agent Village

- 100x100 tile pixel-art map (3200x3200px)
- Up to 6 agents with color-tinted sprites
- 5 activity zones: PARK (spawn/idle), CAFE (handoff), WORKSHOP (working), HOUSE (needs user), DORM (done)
- Smooth movement transitions
- Hover-to-reveal agent name/role labels
- Real-time zone changes based on event type

### 5. Tool System

**Available:** web_search, web_scraper, file_writer, terminal
**Configuration:** Per-agent in agents.yaml
**Integration:** Serper API for search, custom scrapers
**Security:** Terminal uses command allowlist

### 6. Event Streaming

**WebSocket events via `astream_events(v2)`:**
- RUN_STARTED, AGENT_INTENT, AGENT_ACTIVITY, TASK_SUMMARY, TASK_HANDOFF, GATE_REQUESTED, RUN_FINISHED, ERROR

**Frontend:** Real-time event feed, agent cards, zone transitions, activity indicators (blue = LLM, orange = tool)

### 7. Gate System (Human-in-the-Loop)

- Uses LangGraph's native `interrupt()` + `Command(resume=...)` pattern
- `MemorySaver` checkpointer for crash-recoverable state
- Three gating modes: STRICT (every task), BALANCED (final + leader requests), AUTO (final only)
- User approval/rejection with optional feedback
- Feedback appended to agent output for downstream tasks

### 8. API Endpoints

**REST (Port 8001):**
- POST /plan-team — Interactive team building
- POST /run — Start task execution
- GET /agents — Current team config
- POST /agents — Create agent
- PUT /agents/setup — Apply template
- POST /runs/{id}/gates/{id} — Respond to gates

**WebSocket:** WS /runs/{id} — Event stream

---

## Delegation System

### Parallelization Rules
1. Tasks with `dependencies: []` fan out from START and run in parallel
2. Tasks with dependencies wait for all listed tasks to complete
3. Context from completed tasks is passed to dependent tasks via `task_outputs` state
4. Terminal tasks (no downstream dependents) converge into a `synthesize` node
5. `operator.add` reducer on `task_outputs` merges parallel results

### Example Delegation Plan
```yaml
tasks:
  - task_key: researcher_task
    async_execution: false
    dependencies: []
  - task_key: strategist_task
    async_execution: false
    dependencies: []
  - task_key: writer_task
    async_execution: false
    dependencies: [researcher_task, strategist_task]
```
researcher and strategist fan out in parallel from START; writer waits for both.

---

## Architecture

### Backend (FastAPI + LangGraph)

**graph.py** — LangGraph StateGraph engine
- `build_execution_graph()` builds dynamic graph from delegation plan
- `make_worker_node()` factory creates async closures with `create_react_agent`
- `synthesize_node` combines multi-agent outputs via LLM when >1 task
- `MemorySaver` checkpointer for interrupt/resume support

**planner.py** — Team building + delegation planning
- `plan_team()` uses `bind_tools` with `ask_question` / `create_team_files` tools
- `plan_task_delegation()` uses `with_structured_output(CreateDelegationPlanInput)`

**main.py** — FastAPI server
- WebSocket handler streams via `astream_events(v2)` loop
- Interrupt detection via `state.tasks[*].interrupts[*].value`
- Gate resume via `Command(resume=response)`
- `translate_event()` maps LangGraph events to frontend contract

**gate_policy.py** — Gate decision logic (STRICT/BALANCED/AUTO modes)
**events.py** — Event dataclass definitions
**tools.py** — Tool registry (web_search, web_scraper, terminal, file_writer)

### Frontend (React + Phaser 3)

**VillageScene.ts** — Main Phaser scene with zone-based agent movement
**AgentRegistry.ts** — Sprite management, hover labels, progress bars, speech bubbles
**EventFeed.tsx** — Real-time event log
**ws/client.ts** — WebSocket singleton

### Config Files
- agents.yaml — Agent definitions (role, goal, backstory, tools)
- tasks.yaml — Task templates with `{prompt}` placeholder
- delegation_plan.yaml — Execution plan with dependencies
- leader_rules.md — Phase 1 instructions
- delegation_rules.md — Phase 2 & 3 instructions

---

## Running the System

**Backend:**
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

**Frontend:**
```bash
npm run dev  # Opens on localhost:5173+
```

**Required:** ANTHROPIC_API_KEY in .env (project root)
**Optional:** SERPER_API_KEY for web_search tool

---

## Known Limitations

- Max 6 agents (UI constraint)
- Port 8001 required (8000 has caching issues)
- Leader cannot have assigned tasks
- 10-minute gate timeout

---

**Built with:** React, Phaser 3, FastAPI, LangChain, LangGraph, Claude Sonnet 4.5
**Version:** Phase 3 — LangGraph Native Streaming + Human-in-the-Loop
