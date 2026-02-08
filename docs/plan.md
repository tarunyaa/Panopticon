# Panopticon Phase 3 — "Agent Village" MVP

**Timeline:** 1–2 days

**Promise:** A browser-based top-down village where 3–6 agents move between locations based on CrewAI events. Agents go to HQ/Workshop to work, Cafe to coordinate, House for approvals, and Park when idle. User sees a live feed and can intervene.

---

## 0. Tech Choices

| Layer | Choice | Notes |
|-------|--------|-------|
| Game engine | **Phaser 3** | Owns world rendering, sprites, movement |
| Visuals | `generative_agents_visuals/` | Map + tilesets + avatar atlas (use as-is) |
| Frontend shell | **React + Vite** (existing) | Hosts Phaser canvas + UI overlay |
| Backend | **FastAPI** (Python) | CrewAI orchestration + WebSocket event stream |
| AI framework | **CrewAI** | Agent task execution, sequential for MVP |
| Transport | **WebSocket** | Structured events, not token streaming |
| Rendering | Top-down 2D | Phaser canvas, no DOM map |

---

## 1. World + Locations

### Map
- Source: `generative_agents_visuals/public/assets/maps/the_ville_jan7.json`
- Loaded by Phaser's tilemap loader

### Zones (`zones.json`)
Define tile-coordinate rectangles for each named zone. No Tiled map edits needed — just pick coords that land on the visual buildings.

```json
{
  "HOUSE":    { "x": 20, "y": 10, "label": "House" },
  "WORKSHOP": { "x": 45, "y": 25, "label": "Workshop" },
  "CAFE":     { "x": 35, "y": 40, "label": "Cafe" },
  "PARK":     { "x": 55, "y": 45, "label": "Park" }
}
```
*(Exact tile positions TBD once map renders.)*

### Behavior → Zone Mapping

| Agent action | Target zone |
|---|---|
| `ASK_HUMAN` / `NEEDS_APPROVAL` | HOUSE |
| `RESEARCH` / `LIBRARY` | WORKSHOP |
| `WRITE` / `BUILD` | WORKSHOP |
| `PLAN` / `COORDINATE` | CAFE |
| `IDLE` / `WAITING` | PARK |

---

## 2. CrewAI Run Loop

### Flow
1. User enters task prompt → clicks **Run**
2. Backend starts CrewAI → streams structured events over WebSocket
3. Frontend receives `AGENT_INTENT` → agents move in Phaser
4. Gate event → agent goes to HOUSE → modal shows for approve/block
5. Gate resolved → CrewAI continues

### Constraints
- Sequential crew execution for MVP (simplest)
- Keep crew small: 3–6 agents with distinct roles
- Each agent action emits an `AGENT_INTENT` event before execution

---

## 3. Frontend Movement (Event-Driven)

### Principles
- **Do not poll.** WebSocket push only.
- Backend sends **intent, not coordinates.** Frontend maps intent → zone → tile position.

### Event Protocol

**Backend → Frontend:**

```
AGENT_INTENT {
  agentId: string,
  actionType: string,     // e.g. "RESEARCH", "ASK_HUMAN"
  targetZone: string,     // e.g. "WORKSHOP", "HOUSE"
  message: string         // short status text
}

WORLD_SNAPSHOT {           // optional, for resync on reconnect
  agents: [{ agentId, zone, status, message }]
}
```

**Frontend logic:**
1. On `AGENT_INTENT`, look up `targetZone` → tile coordinate from `zones.json`
2. Animate agent sprite to target (tween / per-frame velocity)
3. Update sprite direction + play walk animation (`down-walk.000`, etc.)
4. On arrival, switch to idle animation

---

## 4. Phaser Implementation

### Base
- Reuse / extend `generative_agents_visuals/src/scenes/VillageScene.js`
- **One scene only** for MVP: `VillageScene`
- React overlay handles all UI (feed, modal, input)

### Scene Responsibilities
- Load tilemap + tilesets
- Agent registry: spawn 3–6 sprites from avatar atlas
- Per-agent target position tracking
- Simple movement system (straight-line toward target, per-frame velocity)
- Direction detection → play correct walk animation (`up-walk`, `down-walk`, `left-walk`, `right-walk`)
- On arrival → idle animation

### Movement System (MVP — keep simple)
```
each frame:
  for each agent:
    if agent.target != agent.position:
      direction = normalize(target - position)
      agent.position += direction * speed * dt
      set sprite animation by dominant axis
    else:
      play idle animation
```

### Future (post-MVP)
- A* pathfinding (respect collision tiles)
- Proximity-triggered chat bubbles
- Smooth sprite layering / depth sorting

---

## 5. Backend (FastAPI)

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/run` | Start CrewAI run, returns `{ runId }` |
| `WS` | `/runs/{runId}` | Stream structured events for a run |

### WebSocket Event Types

| Event | Payload | When |
|-------|---------|------|
| `RUN_STARTED` | `{ runId, agents: [...] }` | Crew kicks off |
| `AGENT_INTENT` | `{ agentId, actionType, targetZone, message }` | Agent starts a new action |
| `AGENT_OUTPUT` | `{ agentId, output }` | Agent produces a result (optional) |
| `GATE_REQUESTED` | `{ agentId, gateId, question }` | Human approval needed |
| `GATE_RESOLVED` | `{ gateId, decision, instruction? }` | User approved/blocked |
| `RUN_FINISHED` | `{ runId, summary }` | Crew completed |
| `ERROR` | `{ message }` | Something broke |
| `WORLD_SNAPSHOT` | `{ agents: [...] }` | Full state resync (optional) |

### Gate Flow
1. CrewAI hits a human-input tool → backend emits `GATE_REQUESTED`
2. Frontend shows modal at HOUSE zone
3. User clicks Approve / Block (+ optional instruction)
4. Frontend sends `GATE_RESOLVED` back over WS
5. Backend unblocks CrewAI → continues

---

## 6. UI (React Overlay)

All UI lives **outside** the Phaser canvas as React components.

| Component | Purpose |
|-----------|---------|
| **TaskInput** | Text input + "Run" button to start a crew |
| **EventFeed** | Scrolling one-line-per-event log |
| **AgentPopover** | Click agent sprite → shows name, role, state |
| **GateModal** | Approve / Block + instruction textarea |

### Layout
```
┌─────────────────────────────────────┐
│ [Task input]              [Run]     │
├─────────────────────────────────────┤
│                                     │
│         Phaser Canvas               │
│         (village map)               │
│                                     │
├─────────────────────────────────────┤
│ Event Feed (scrollable)             │
│  > Agent-1 → WORKSHOP: Researching  │
│  > Agent-2 → CAFE: Planning         │
│  > Agent-3 → HOUSE: Needs approval  │
└─────────────────────────────────────┘

        [Gate Modal - overlay]
```

---

## 7. Game-Feel Polish (Cheap Wins)

- **Idle bob:** tween sprite Y ±2px on a 2s loop when stationary
- **Action icon:** tiny icon floats above head per action type (wrench, book, coffee, etc.)
- **Door ping:** visual pulse on HOUSE building when gate event fires
- **Arrival settle:** slight bounce when agent reaches destination

---

## 8. Implementation Order

Ship fastest by layering incrementally:

### Step 1 — Render the world
- [ ] Confirm `generative_agents_visuals` assets are in place
- [ ] Get Phaser loading the tilemap in a React-hosted canvas
- [ ] Camera controls (pan/zoom)

### Step 2 — Zones + agent sprites
- [ ] Create `zones.json` with tile coordinates for HOUSE, WORKSHOP, CAFE, PARK
- [ ] Spawn 3–6 agent sprites from the avatar atlas
- [ ] Place agents at PARK (default idle position)

### Step 3 — WebSocket client + movement
- [ ] Connect to `WS /runs/{runId}`
- [ ] On `AGENT_INTENT` → look up zone → set agent target
- [ ] Implement straight-line movement + walk animations
- [ ] Idle animation on arrival

### Step 4 — CrewAI backend
- [ ] FastAPI app with `POST /run` + `WS /runs/{runId}`
- [ ] Define a small crew (3–6 agents, distinct roles)
- [ ] Hook CrewAI callbacks to emit structured events
- [ ] Wire gate tool for human-in-the-loop

### Step 5 — Gate modal + approval flow
- [ ] `GATE_REQUESTED` → agent moves to HOUSE → modal appears
- [ ] Approve / Block buttons send `GATE_RESOLVED` back
- [ ] CrewAI unblocks and continues

### Step 6 — Event feed + polish
- [ ] Scrolling event feed component
- [ ] Agent popover on sprite click
- [ ] Idle bob animation
- [ ] Action icons above heads
- [ ] Door ping effect on gate events

---

## File Structure (Target)

```
panopticon-phase3/
├── src/                          # Frontend (React + Phaser)
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # React shell (input, feed, modal)
│   ├── phaser/
│   │   ├── game.ts              # Phaser.Game config + bootstrap
│   │   ├── scenes/
│   │   │   └── VillageScene.ts  # Main game scene
│   │   ├── systems/
│   │   │   └── movement.ts      # Agent movement logic
│   │   └── registry/
│   │       └── AgentRegistry.ts # Agent sprite management
│   ├── components/
│   │   ├── TaskInput.tsx
│   │   ├── EventFeed.tsx
│   │   ├── AgentPopover.tsx
│   │   └── GateModal.tsx
│   ├── ws/
│   │   └── client.ts            # WebSocket client + event dispatch
│   ├── data/
│   │   └── zones.json           # Zone tile coordinates
│   └── types/
│       └── events.ts            # Shared event type definitions
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── crew.py                  # CrewAI crew definition
│   ├── events.py                # Event types + emitter
│   ├── gate.py                  # Human gate logic
│   └── requirements.txt         # Python deps (fastapi, uvicorn, crewai, websockets)
├── generative_agents_visuals/   # Existing visual assets (use as-is)
│   └── public/assets/
│       ├── maps/
│       ├── tilesets/
│       └── avatars/
├── zones.json
├── package.json
├── vite.config.ts
└── plan.md                      # This file
```

---

## Key Decisions

1. **Phaser owns the world** — React does not render the map or agents. Phaser canvas is embedded in a React component via a ref.
2. **Intent, not coordinates** — Backend says "go to WORKSHOP", frontend resolves the pixel position. This decouples AI logic from rendering.
3. **Sequential CrewAI** — No parallel agent execution for MVP. Simplifies event ordering.
4. **One scene** — `VillageScene` only. No boot screen, no scene transitions in Phaser.
5. **Existing assets** — Don't recreate sprites or maps. Use `generative_agents_visuals` as-is.
6. **Straight-line movement** — No pathfinding for MVP. Agent walks directly to target tile.
