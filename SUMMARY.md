# Panopticon Phase 3 - Project Summary

## Overview

**Panopticon** is an interactive AI agent village where users can watch CrewAI agents work in real-time within a 2D pixel-art world. The system combines a **React + Phaser 3** frontend with a **FastAPI + CrewAI** backend to create a visual, transparent multi-agent workflow system with human-in-the-loop controls.

Users onboard by designing a custom AI team through an LLM-guided interview, then watch their agents move around a village map while collaborating on tasks. The system provides real-time visibility into agent activities and allows users to approve/reject outputs at each step via approval gates.

---

## Architecture

### High-Level Stack

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + Phaser 3)                     │
│  - Onboarding flow (login, avatar selection, team plan) │
│  - 2D village game world (Phaser)                       │
│  - Agent cards, event feed, task input                  │
│  - Gate modals (approve/reject)                         │
└─────────────────────────────────────────────────────────┘
                          ↕ (REST API + WebSocket)
┌─────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI + CrewAI + Anthropic)                 │
│  - POST /run → Start CrewAI execution                   │
│  - WS /runs/{runId} → Stream events                     │
│  - LLM-driven team planner (POST /plan-team)            │
│  - Dynamic agent/task management (YAML)                 │
│  - Gate system (human approval checkpoints)             │
└─────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. **LLM-Driven Team Planning**
   - **File:** `backend/planner.py`
   - Uses Anthropic's Claude (tool use API) to interview the user
   - Leader agent asks 2-4 clarifying questions about the task
   - Generates 3-4 specialized agents with:
     - Role, goal, backstory
     - Task description (must include `{prompt}` placeholder)
     - Expected output
     - Tool assignments (web_search, web_scraper, terminal, file_writer)
   - Includes example team templates (Development, Content, Research)
   - Uses structured tool_use for reliable JSON output

### 2. **Visual Agent Village**
   - **File:** `src/phaser/scenes/VillageScene.ts`
   - 100×100 tile map (3200×3200 pixels) with multiple zones:
     - **HOUSE** (study/home office) → Planning, strategy, management agents
     - **WORKSHOP** (lab/engineering space) → Research, coding, analysis agents
     - **CAFE** (creative space) → Writing, content creation, design agents
     - **PARK** (outdoor area) → Review, QA, general-purpose agents
   - 6 character sprites (preloaded, tinted with team colors)
   - Agents walk to their assigned zones when they start working
   - Smooth pixel-perfect movement system

### 3. **Zone Inference System**
   - **File:** `backend/zone_infer.py`
   - Keyword-based scoring to map agents → zones
   - Analyzes role + goal + backstory + task description
   - Automatically assigns new agents to the most appropriate zone
   - Used during onboarding and dynamic agent creation

### 4. **Real-Time Event Streaming**
   - **File:** `backend/events.py`
   - WebSocket-based event bus broadcasts to frontend:
     - `RUN_STARTED` → Run initiated with user prompt
     - `AGENT_INTENT` → Agent starts working (triggers zone movement)
     - `TASK_SUMMARY` → Agent completes task (summary + full output)
     - `GATE_REQUESTED` → Human approval checkpoint
     - `RUN_FINISHED` → All tasks complete
     - `ERROR` → Exception occurred
   - Singleton `EventBus` manages per-run async queues
   - `GateStore` handles human-in-the-loop approval flow

### 5. **Human-in-the-Loop Gates**
   - **Files:** `backend/events.py`, `src/components/GateModal.tsx`
   - After each agent completes their task, a gate is created
   - Crew execution blocks until user approves/rejects
   - Approval: Continue to next task (optional feedback → appended to next agent's prompt)
   - Rejection: Abort the entire run
   - 10-minute timeout per gate
   - Modal UI with "Approve" and "Reject" buttons

### 6. **Dynamic Agent Management**
   - Agents defined in `backend/agents.yaml` (role, goal, backstory, tools)
   - Tasks defined in `backend/tasks.yaml` (description, expected_output, agent reference)
   - REST API:
     - `GET /agents` → List all agents with zone assignments
     - `POST /agents` → Create single agent
     - `PUT /agents/setup` → Replace entire team (used during onboarding)
   - Max 6 agents total
   - Thread-safe YAML read/write with locks

### 7. **CrewAI Hierarchical Execution**
   - **File:** `backend/crew.py`
   - Process: `hierarchical` with auto-generated manager LLM
   - Planning enabled (manager decomposes tasks upfront)
   - All tasks run `async_execution=True` except the last (which aggregates context)
   - Claude Sonnet 4 as the agent LLM
   - Custom step callbacks emit `AGENT_INTENT` on first action
   - Custom task callbacks emit `TASK_SUMMARY` + gate creation
   - ReAct output cleaning (strips internal CrewAI markers)

### 8. **Multi-Screen Onboarding Flow**
   - **Step 1: Login** (`LoginScreen.tsx`) → Enter and see village background
   - **Step 2: Avatars** (`AvatarSelectScreen.tsx`) → Pick user avatar + leader avatar
   - **Step 3: Team Plan** (`TeamPlanScreen.tsx`):
     - User enters crew name + task description
     - Can choose a template team (Dev, Content, Research) OR
     - Click "Let the Leader Plan" → LLM interview flow (2-4 Q&A rounds)
     - Review generated team, edit agents, then "Enter Village"
   - **Step 4: Main View** → Game + Sidebar

### 9. **Sandboxed Tool System**
   - **File:** `backend/tools.py`
   - **web_search** → Serper API (requires `SERPER_API_KEY`)
   - **web_scraper** → ScrapeWebsiteTool (no API key)
   - **terminal** → Sandboxed shell (whitelist: ls, cat, grep, python, git, etc.; blocks: rm, del, install, redirects)
   - **file_writer** → FileWriterTool (writes to disk)
   - All tools wrapped with safe error handling (return tool error strings instead of throwing)

---

## Key Files

### Backend
| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app with REST + WebSocket endpoints |
| `backend/crew.py` | CrewAI setup, task execution, callbacks, event emission |
| `backend/planner.py` | LLM-driven team planner (Anthropic tool use API) |
| `backend/events.py` | Event bus, gate store, event dataclasses |
| `backend/tools.py` | Tool registry + sandboxed implementations |
| `backend/zone_infer.py` | Keyword-based zone assignment algorithm |
| `backend/agents.yaml` | Agent definitions (role, goal, backstory, tools) |
| `backend/tasks.yaml` | Task definitions (description, expected_output, agent) |

### Frontend
| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app component, onboarding state machine |
| `src/phaser/game.ts` | Phaser game initialization, singleton accessor |
| `src/phaser/scenes/VillageScene.ts` | Main Phaser scene (tilemap, agent sprites, camera) |
| `src/phaser/registry/AgentRegistry.ts` | Manages agent sprites, spawning, tinting, animations |
| `src/phaser/systems/movement.ts` | Per-frame movement interpolation toward target zones |
| `src/ws/client.ts` | WebSocket client singleton, event handler management |
| `src/components/Sidebar.tsx` | Agent roster, task input, event feed (main UI) |
| `src/components/GateModal.tsx` | Human approval gate UI |
| `src/components/onboarding/TeamPlanScreen.tsx` | LLM interview + team review screen |

---

## Data Flow

### Onboarding Flow
1. User picks avatars → selects leader
2. User enters task description
3. Option A: Choose template → populate agents from `TEMPLATES`
4. Option B: Click "Let the Leader Plan" → POST `/plan-team`:
   - LLM asks clarifying questions (2-4 rounds)
   - User answers each question
   - LLM generates team with `create_team` tool
5. Frontend displays generated team → user can edit
6. Click "Enter Village" → PUT `/agents/setup` (replace all agents/tasks atomically)
7. Backend assigns zones via `infer_zone()`
8. Frontend emits `spawn-agents` event → Phaser spawns sprites

### Run Flow
1. User clicks "Run Task" → POST `/run` with prompt
2. Backend:
   - Creates run ID, event queue
   - Spawns thread to execute `run_crew()`
   - Returns run ID immediately
3. Frontend connects WebSocket → `WS /runs/{runId}`
4. CrewAI starts:
   - Emits `RUN_STARTED`
   - For each agent/task:
     - First step → emits `AGENT_INTENT` → Phaser moves agent to zone
     - Task completes → emits `TASK_SUMMARY` → creates gate
     - User approves/rejects via `POST /runs/{runId}/gates/{gateId}`
     - If approved + feedback → append note to next agent's prompt
   - Final task completes → emits `RUN_FINISHED`
5. Frontend displays events in feed, shows gate modals

---

## Technical Highlights

### Novel Patterns
1. **LLM-as-a-Service Team Builder:** Uses Claude's tool use API to conduct structured interviews and output JSON (no prompt engineering fragility)
2. **Zone Inference:** Keyword scoring algorithm maps abstract agent roles → physical map zones
3. **Phaser + React Bridge:** Game events (`spawn-agents`, `agent-intent`) cross the boundary via Phaser's event emitter
4. **Human-in-the-Loop via Threading:** CrewAI runs in ThreadPoolExecutor; gates use `threading.Event` to block until user responds
5. **ReAct Output Cleaning:** Regex-based cleaning strips CrewAI's internal ReAct markers (`Thought:`, `Action:`, etc.) for clean summaries

### Design Decisions
- **Why hierarchical process?** Allows a manager LLM to delegate tasks and plan upfront
- **Why async_execution on all but last task?** Enables parallel work; final task aggregates all context
- **Why YAML for agents/tasks?** Easy to edit, version-controlled, human-readable
- **Why Anthropic over OpenAI?** Project uses Claude Sonnet 4 (latest model at time of build)
- **Why WebSocket instead of polling?** Low-latency real-time event streaming for smooth UX

### Gotchas (from MEMORY.md)
- Map is 100×100 tiles at 32px = 3200×3200 pixels
- Tilemap layer `"Interior Furniture L2 "` has trailing space (must match exactly)
- `tsconfig.json` needs `resolveJsonModule` and `esModuleInterop` for zones.json import
- Must create `src/vite-env.d.ts` with `/// <reference types="vite/client" />` for CSS imports
- Phaser bundle is ~1.5MB, triggers Vite chunk size warning (expected)
- Must run `uvicorn backend.main:app` from project root (not from `backend/` directory)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 18.3.1 |
| | Vite | 5.4.11 |
| | TypeScript | 5.6.2 |
| | Phaser 3 | 3.90.0 |
| | TailwindCSS | 3.4.15 |
| **Backend** | Python | 3.10–3.13 |
| | FastAPI | Latest |
| | CrewAI | Latest |
| | Anthropic SDK | Latest |
| | PyYAML | Latest |
| **LLM** | Claude Sonnet 4 | claude-sonnet-4-20250514 |
| **APIs** | Serper | (optional, for web_search tool) |

---

## Future Enhancements (not implemented)

- **Task history view:** Show past runs with outputs
- **Agent editing in main view:** Currently can only add agents, not edit/delete
- **Multi-user support:** Currently single-user local app
- **Agent memory/context:** Persist agent learnings across runs
- **Visual task progress bars:** Show % completion during long runs
- **Zoom/pan controls:** Currently camera auto-centers on agents
- **Custom sprite upload:** Currently limited to 6 built-in sprites
- **Run cancellation:** No way to abort a run mid-execution

---

## Running the Project

### Prerequisites
- Python 3.10–3.13
- Node.js 18+
- Anthropic API key
- (Optional) Serper API key for web search

### Setup
```bash
# Frontend
npm install
npm run dev

# Backend
cd panopticon
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install crewai anthropic pyyaml fastapi uvicorn websockets python-dotenv
# Add ANTHROPIC_API_KEY to panopticon/.env

# Run backend from project root
uvicorn backend.main:app --reload
```

### Endpoints
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend API: `http://localhost:8000`
- Backend WebSocket: `ws://localhost:8000/runs/{runId}`

---

## Project Structure

```
panopticon-phase3/
├── backend/                    # FastAPI + CrewAI backend
│   ├── main.py                # REST + WebSocket server
│   ├── crew.py                # CrewAI execution engine
│   ├── planner.py             # LLM team planner
│   ├── events.py              # Event bus + gate store
│   ├── tools.py               # Sandboxed tool registry
│   ├── zone_infer.py          # Zone assignment algorithm
│   ├── agents.yaml            # Agent definitions
│   └── tasks.yaml             # Task definitions
├── src/                       # React + Phaser frontend
│   ├── App.tsx                # Main app + onboarding flow
│   ├── phaser/                # Phaser game code
│   │   ├── game.ts            # Game initialization
│   │   ├── scenes/VillageScene.ts  # Main game scene
│   │   ├── registry/AgentRegistry.ts  # Agent sprite management
│   │   └── systems/movement.ts     # Movement interpolation
│   ├── components/            # React UI components
│   │   ├── Sidebar.tsx        # Main sidebar
│   │   ├── GateModal.tsx      # Approval gate UI
│   │   ├── TaskInput.tsx      # Task submission form
│   │   ├── EventFeed.tsx      # Real-time event log
│   │   └── onboarding/        # Onboarding screens
│   ├── ws/client.ts           # WebSocket singleton
│   └── types/                 # TypeScript definitions
├── public/assets/             # Game assets (tilemap, sprites)
├── package.json               # npm dependencies
├── vite.config.ts             # Vite build config
├── tailwind.config.js         # TailwindCSS theme
└── SUMMARY.md                 # This file
```

---

## Summary

**Panopticon Phase 3** is a production-quality proof-of-concept for **transparent multi-agent AI systems**. It demonstrates:

1. **Visual AI transparency** → Watch agents work in real-time on a map
2. **LLM-driven team design** → AI interviews user to build optimal team
3. **Human-in-the-loop control** → Approve/reject outputs with feedback
4. **Dynamic agent management** → Add/edit agents on the fly
5. **Real-time event streaming** → See what agents are thinking and doing
6. **Hierarchical delegation** → Manager LLM plans and delegates tasks

The system bridges the gap between abstract LLM APIs and tangible, controllable workflows. Users get the power of multi-agent systems with the visibility and control of traditional software.
