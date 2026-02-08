# CrewAI Integration Summary

## Overview

Panopticon Phase 3 integrates CrewAI into a real-time, visual multi-agent system. A React + Phaser 3 frontend renders AI agents as pixel-art sprites on a tilemap village, while a FastAPI backend orchestrates CrewAI crews and streams execution events over WebSocket.

---

## Backend

### FastAPI Endpoints (`backend/main.py`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/agents` | GET | Returns all agents (merged from agents.yaml + tasks.yaml) and `maxAgents` (6) |
| `/agents` | POST | Creates a single agent — validates ID format, auto-assigns zone round-robin, **appends** to YAML files (used by Sidebar "Add Agent") |
| `/agents/setup` | PUT | **Replaces** all agents and tasks atomically — validates IDs upfront (format, uniqueness, max count), writes YAML in `"w"` mode, returns assigned zones (used during onboarding) |
| `/run` | POST | Accepts `{ prompt }`, creates a run ID, kicks off CrewAI in a thread pool (max 4 workers) |
| `/runs/{runId}` | WebSocket | Streams JSON events to the frontend; closes on `RUN_FINISHED` |

CORS is open for all origins. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are loaded from `panopticon/.env`.

### CrewAI Setup (`backend/crew.py`)

- Reads `agents.yaml` and `tasks.yaml` fresh on every run
- Creates CrewAI `Agent` objects with `claude-sonnet-4-20250514` as the LLM
- Process mode: **hierarchical** — CrewAI auto-creates a manager agent (via `manager_llm`) that parses the user's prompt, inspects each worker agent's role/goal/backstory, and delegates tasks to the appropriate agents. The manager also validates outputs before proceeding. Since agents and tasks are read from YAML fresh each run, the manager automatically adapts to whatever agents the user has configured (templates, custom agents, mixed).
- `planning=True` — Enables CrewAI's built-in planning step where the manager creates an execution plan before delegating.
- Prompt interpolation: `{prompt}` in task descriptions is replaced with the user's input. If a task description is missing `{prompt}`, crew.py auto-appends `"\n\nUser's request: {prompt}"` before formatting — ensures every agent receives the prompt regardless of template authoring

**Callbacks:**

| Callback | Fires When | Emits |
|---|---|---|
| Step callback | Agent takes its first reasoning step | `AGENT_INTENT` (once per agent) |
| Task callback | Agent finishes its task | `TASK_SUMMARY` with cleaned/summarized output |

**Output cleaning:** Strips internal ReAct markers (`Thought:`, `Action:`, `Final Answer:`, etc.), collapses blank lines, and truncates summaries to ~160 characters.

### Event Bus (`backend/events.py`)

An async queue per `runId`. Events are Python dataclasses serialized to JSON.

| Event | Fields | When |
|---|---|---|
| `RUN_STARTED` | runId, prompt | Crew kickoff |
| `AGENT_INTENT` | agentName, zone, message | Agent's first step |
| `TASK_SUMMARY` | agentName, summary, fullOutput | Agent task completion |
| `RUN_FINISHED` | runId | Crew done (or error) |
| `ERROR` | message | Exception during run |

### Zone Inference (`backend/zone_infer.py`)

Keyword-based scoring maps agent metadata to one of four zones:

- **HOUSE** — planning, management, architecture, scheduling
- **WORKSHOP** — research, analysis, coding, engineering, testing
- **CAFE** — writing, creativity, design, communication
- **PARK** — review, QA, validation (also the default fallback)

Currently unused; zones are assigned round-robin in the create endpoint: `[HOUSE, WORKSHOP, CAFE, PARK, HOUSE, WORKSHOP]`.

### Configuration Files

- **`agents.yaml`** — Replaced atomically during onboarding via `PUT /agents/setup`; contains only the user's chosen agents (no stale defaults)
- **`tasks.yaml`** — One task per agent with `{prompt}` interpolation and expected output descriptions; also replaced atomically during onboarding
- **`zones.json`** — Pixel coordinates for each zone on the tilemap

---

## Frontend

### Onboarding Flow (`src/App.tsx`)

Four sequential steps:

1. **Login** — Entry screen
2. **Avatars** — Pick user + leader character sprites
3. **Team** — Choose from preset templates (Development, Content, Research) or manually configure agents
4. **Main** — Game + sidebar rendered

On "Enter Village":
- All agents are sent in a single `PUT /agents/setup` call, which **replaces** both YAML files atomically (no stale hardcoded agents remain)
- Assigned zones are read from the batch response
- A `spawn-agents` event is emitted to Phaser with the full `AgentDef[]`

### Agent Management (`src/hooks/useAgents.ts`)

- Fetches agents from `GET /agents` on mount
- `createAgent(payload)` — POSTs a single agent via `POST /agents` (append), refetches the list, emits `agent-created` to Phaser
- `batchCreateAgents(payloads)` — Calls `PUT /agents/setup` to replace all agents atomically, returns created agents with zones

### Sidebar Components (`src/components/`)

| Component | Purpose |
|---|---|
| `Sidebar` | Container: logo, agent roster, detail panel, task input, event feed |
| `AgentCardFilled` | Roster item with sprite crop, color dot, and truncated role |
| `AgentDetailPanel` | Read-only expanded view: goal, backstory, task, expected output |
| `TaskInput` | Textarea → `POST /run` → connects WebSocket for the new run |
| `EventFeed` | Renders streamed events with type-specific styling and colors |
| `AgentFormModal` | Modal for creating/editing agents with avatar picker and form fields |

### WebSocket Client (`src/ws/client.ts`)

Singleton `wsClient` connects to `ws://localhost:8000/runs/{runId}`. Handlers:

- `on("event", handler)` — All events
- `on("intent", handler)` — Filtered to `AGENT_INTENT` only

A new connection is opened per run; existing connections are closed first.

### Type Definitions

- **`src/types/agents.ts`** — `AgentInfo`, `AVATARS` (8 characters), `ALL_SPRITES` (spritesheets), `PHASER_COLORS`, `SLOT_COLORS`
- **`src/types/onboarding.ts`** — `OnboardingAgent`, `TemplatePreset` (3 presets with 3-4 agents each)
- **`src/types/events.ts`** — `ZoneId`, all WebSocket event types, `WSEvent` union

---

## Phaser Integration

### Game Init (`src/phaser/game.ts`)

- `createGame(parent, sceneData?)` — Singleton Phaser game with RESIZE scale mode, pixel-art rendering, arcade physics
- Scene: `VillageScene`

### Village Scene (`src/phaser/scenes/VillageScene.ts`)

**Preload:** Tilemap (`the_ville_jan7.json`, 100x100 tiles at 32px), collision blocks, interior/exterior tilesets, character spritesheets.

**Create:** Builds 8 tilemap layers, sets foreground depth, configures collision, spawns agents, centers camera on PARK at 0.5x zoom.

**Event listeners:**

| Event | Source | Action |
|---|---|---|
| `spawn-agents` | App.tsx onboarding | `registry.spawn(defs)` — batch spawn at PARK, walk to zones |
| `agent-created` | useAgents hook | `registry.spawnOne(def)` — single agent at runtime |
| WebSocket `AGENT_INTENT` | wsClient | `setTarget(agent, zone)` + `setProgress(0.15)` |
| WebSocket `RUN_STARTED` | wsClient | `moveAllToZone("PARK")` |
| WebSocket `TASK_SUMMARY` | wsClient | `setProgress(agent, 1)` |
| WebSocket `RUN_FINISHED` | wsClient | `moveAllToZone("PARK")` |

**Update loop:** Per-frame movement, progress bar ticking, arrow-key camera panning.

### Agent Registry (`src/phaser/registry/AgentRegistry.ts`)

Each agent entry contains:
- **Sprite** — Phaser arcade sprite with 4-direction walk animations (6 FPS)
- **Marker** — Colored circle below sprite
- **Label** — Name + role text above sprite
- **Progress bar** — 50px wide, color-filled rectangle
- **Target position** — Destination for movement system

Key methods: `spawn()`, `spawnOne()`, `setTarget()`, `moveAllToZone()`, `setProgress()`, `tickProgress()`.

### Movement System (`src/phaser/systems/movement.ts`)

- Speed: 120 px/frame
- Arrival threshold: 4px
- Chooses walk animation direction based on dx vs dy
- Stops and sets idle frame on arrival
- Updates label, marker, and progress bar positions each frame

---

## Data Flow

```
User submits prompt in TaskInput
        │
        ▼
  POST /run → runId
        │
        ▼
  wsClient.connect(runId)          CrewAI thread starts
        │                                  │
        │                          emit RUN_STARTED
        │                                  │
        │                          Manager parses prompt, plans execution
        │                          Manager delegates to Agent N
        │                            Agent N steps → emit AGENT_INTENT
        │                            Agent N done  → emit TASK_SUMMARY
        │                          Manager validates, delegates next...
        │                          ...
        │                          emit RUN_FINISHED
        │                                  │
        ▼                                  ▼
  WebSocket streams events ◄──── Event Bus queues
        │
        ├─► EventFeed (React) renders event cards
        └─► VillageScene (Phaser) moves sprites to zones, fills progress bars
```

---

## Key Implementation Details

1. **Agent ID format** — Lowercase, alphanumeric + underscores only
2. **Zone assignment** — Round-robin: HOUSE → WORKSHOP → CAFE → PARK → HOUSE → WORKSHOP
3. **Max agents** — 6
4. **Display names** — agent_id is title-cased with underscores replaced by spaces
5. **Avatar assignment** — Round-robin from 8-character AVATARS array
6. **Progress bars** — Tick slowly toward 90% each frame; jump to 100% on TASK_SUMMARY
7. **Leader agent** — Always slot 0 in onboarding; locked from deletion
8. **Tilemap gotcha** — Layer "Interior Furniture L2 " has a trailing space
