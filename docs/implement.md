# Panopticon Phase 3 — Implementation Plan

## Context
Build the "Agent Village" MVP: a browser-based top-down village where 4 AI agents (Planner, Researcher, Writer, Reviewer) move between zones based on CrewAI events. The user enters a task, CrewAI runs, and agents visually move on the Phaser tilemap. An event feed shows what's happening. Gates (human approval) are skipped for MVP.

## Decisions Made
- **Assets**: Copy `generative_agents_visuals/public/assets/` → root `public/assets/`
- **Language**: TypeScript for all Phaser code
- **LLM**: Anthropic Claude
- **Agents**: 4 — Planner, Researcher, Writer, Reviewer
- **Gates**: Skipped for MVP

---

## Step 1 — Render the world (Phaser in React)

### 1a. Install Phaser npm package
```
npm install phaser
```

### 1b. Copy assets to `public/`
Copy `generative_agents_visuals/public/assets/` → `public/assets/`

### 1c. Create `src/phaser/game.ts`
- Phaser.Game config (1280x720, arcade physics, pixel art)
- Export a `createGame(parentEl: HTMLElement)` function
- Single scene: VillageScene

### 1d. Create `src/phaser/scenes/VillageScene.ts`
- Port `generative_agents_visuals/src/scenes/VillageScene.js` to TypeScript
- Remove player keyboard controls (agents are AI-driven, not user-controlled)
- Keep: tilemap loading, tileset setup, layer creation, camera setup

### 1e. Rewrite `src/App.tsx`
- Delete all dead imports
- Simple layout: Phaser canvas fills the screen
- Phaser canvas via `useRef` + `useEffect` calling `createGame(ref.current)`
- Stub TaskInput and EventFeed as empty placeholders for now

**Verify**: `npm run dev` → tilemap renders in the browser inside the React app.

---

## Step 2 — Zones + Agent Sprites

### 2a. Create `src/data/zones.json`
- 4 zones: HOUSE, WORKSHOP, CAFE, PARK
- Each has `x`, `y` (tile coordinates), `label`
- Exact coordinates TBD after we see the rendered map

### 2b. Create `src/phaser/registry/AgentRegistry.ts`
- Manages 4 agent sprites
- Each agent: `{ id, name, role, sprite, targetX, targetY, color }`
- Spawn from atlas, differentiate with `setTint()` (4 distinct colors)
- Place all at PARK zone initially

### 2c. Create `src/types/events.ts`
- TypeScript types for all WebSocket events: `AGENT_INTENT`, `RUN_STARTED`, `AGENT_OUTPUT`, `RUN_FINISHED`, `ERROR`, `WORLD_SNAPSHOT`

### 2d. Wire into VillageScene
- In `create()`, load zones.json, instantiate AgentRegistry, spawn 4 agents at PARK

**Verify**: 4 tinted sprites visible on the map at the PARK zone.

---

## Step 3 — Movement System + WebSocket Client

### 3a. Create `src/phaser/systems/movement.ts`
- Per-frame update: for each agent, if target != position, move toward target at constant speed
- Set walk animation based on dominant axis direction
- On arrival, play idle animation

### 3b. Create `src/ws/client.ts`
- WebSocket client that connects to `ws://localhost:8000/runs/{runId}`
- On `AGENT_INTENT` → look up zone → set agent target in AgentRegistry
- Expose a simple event emitter for React components to subscribe to events

### 3c. Wire movement into VillageScene.update()
- Call movement system each frame

### 3d. Bridge React ↔ Phaser
- Phaser scene exposes methods to set agent targets
- WebSocket client calls these methods on events
- React components subscribe to WS events for the feed

**Verify**: Manually send a test WS message → agent walks to the correct zone.

---

## Step 4 — CrewAI Backend (FastAPI)

### 4a. Create `backend/requirements.txt`
```
fastapi
uvicorn[standard]
websockets
crewai
anthropic
```

### 4b. Create `backend/main.py`
- `POST /run` — accepts `{ prompt }`, starts CrewAI in background thread, returns `{ runId }`
- `WS /runs/{runId}` — streams structured events to frontend
- CORS middleware for dev

### 4c. Create `backend/events.py`
- Event dataclasses matching `src/types/events.ts`
- AsyncIO queue for event dispatch

### 4d. Create `backend/crew.py`
- 4 agents: Planner, Researcher, Writer, Reviewer
- Sequential process
- CrewAI step/task callbacks → emit `AGENT_INTENT` events with zone mapping
- Anthropic Claude as LLM

### 4e. Create `backend/agents.yaml` + `backend/tasks.yaml`
- Agent definitions with roles, goals, backstories
- Task definitions that chain: plan → research → write → review

**Verify**: `uvicorn backend.main:app` + `npm run dev` → enter a prompt → agents move on the map.

---

## Step 5 — Skip (Gates)
No implementation needed.

---

## Step 6 — Event Feed + Polish

### 6a. Implement `src/components/EventFeed.tsx`
- Scrolling log of events from WebSocket
- Each line: `> Agent-Name → ZONE: message`

### 6b. Implement `src/components/TaskInput.tsx`
- Text input + "Run" button
- POST to `/run`, then connect WebSocket with returned `runId`

### 6c. Polish in VillageScene
- Idle bob: tween sprite Y ±2px on 2s loop when stationary
- Name labels: text above each agent sprite

**Verify**: Full end-to-end flow works — enter prompt, agents move, events scroll.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `public/assets/` | Copy from generative_agents_visuals |
| `src/App.tsx` | Rewrite (remove dead imports) |
| `src/phaser/game.ts` | Create |
| `src/phaser/scenes/VillageScene.ts` | Create (port from .js) |
| `src/phaser/registry/AgentRegistry.ts` | Create |
| `src/phaser/systems/movement.ts` | Create |
| `src/types/events.ts` | Create |
| `src/data/zones.json` | Create |
| `src/ws/client.ts` | Create |
| `src/components/TaskInput.tsx` | Create |
| `src/components/EventFeed.tsx` | Create |
| `backend/main.py` | Create |
| `backend/crew.py` | Create |
| `backend/events.py` | Create |
| `backend/requirements.txt` | Create |
| `backend/agents.yaml` | Create |
| `backend/tasks.yaml` | Create |
