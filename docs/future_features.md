# Future Features — Implementation Plan

## 1. Zone-Based Memory System

**Goal**: Each building in the village is a **memory store** for a specific type of context. Agents write to these stores during runs, and read from them on future runs — so the village accumulates institutional knowledge over time.

### Memory Architecture (CrewAI-inspired)

| Building | Zone ID | Memory Type | What gets stored |
|----------|---------|-------------|-----------------|
| Library | `LIBRARY` | Research notes | Web search results, scraped content, factual lookups |
| Workshop | `WORKSHOP` | Drafts & artifacts | Code snippets, written drafts, tool outputs, intermediate work |
| Cafe | `CAFE` | Conversation summaries | Agent-to-agent handoff context, delegation reasoning, synthesis notes |
| House | `HOUSE` | User feedback | Gate feedback, corrections, rejected outputs, user preferences |

The **Library** is a new building — it doesn't exist on the current tilemap (`zones.json` only has HOUSE, WORKSHOP, CAFE, PARK, DORM). It needs to be placed on the map as a new zone.

### Current State
- Gate feedback is appended inline to `final_output` as `[Human feedback]: {note}` (`graph.py:206-208`)
- No persistence — all context is lost after a run ends
- Agent system prompt is built fresh each run in `make_worker_node()` (`graph.py:112-124`)
- Zones are purely visual — they have no data associated with them

### Implementation Plan

**Backend — Memory Store**:
1. **Memory directory structure**: `backend/memory/{zone_type}/` with files per agent or shared:
   ```
   backend/memory/
     library/          # research notes (per-agent .md files)
     workshop/         # drafts & artifacts (per-agent .md files)
     cafe/             # conversation summaries (shared + per-run)
     house/            # user feedback (per-agent .md files)
   ```
2. **Write hooks in `graph.py`**: Instrument `make_worker_node()` to capture and persist context at the right moments:
   - **Library**: After any `web_search` or `web_scraper` tool call completes, append the query + result summary to `memory/library/{agent_id}.md`
   - **Workshop**: After the agent produces its `final_output`, save the artifact to `memory/workshop/{agent_id}.md` (keyed by task)
   - **Cafe**: When a worker node receives dependency context from upstream agents (`context_parts` in `graph.py:135-145`), log the handoff summary to `memory/cafe/{run_id}.md`. Also log `synthesize_node` output here
   - **House**: On gate resume with feedback (`graph.py:202-208`), append the user's note + the output it was about to `memory/house/{agent_id}.md` with a timestamp
3. **Inject memory into system prompt**: At the start of `make_worker_node()`, read the agent's relevant memory files and append to the system message:
   ```
   ## Your Memory
   ### Past research (Library)
   {contents of memory/library/{agent_id}.md}
   ### Past work (Workshop)
   {contents of memory/workshop/{agent_id}.md}
   ### User feedback (House)
   {contents of memory/house/{agent_id}.md}
   ```
   Truncate/summarize if memory exceeds a token budget (e.g. last 5 entries per zone).
4. **REST endpoints**:
   - `GET /memory/{zone}` — list all entries for a zone
   - `GET /memory/{zone}/{agent_id}` — get a specific agent's memory for a zone
   - `DELETE /memory/{zone}/{agent_id}` — clear an agent's memory for a zone
   - `DELETE /memory` — wipe all memory (fresh start)

**Frontend — Memory in the Village**:
5. **Add LIBRARY zone**: Add a new building to the tilemap and register it in `zones.json` with coordinates. Visually it should look like a small pixel-art library/bookshelf building
6. **Memory viewer in sidebar**: Add a "Memory" tab in `Sidebar.tsx` or `AgentCard.tsx` that shows the agent's accumulated memory across all zones, organized by building
7. **Zone glow / badge**: When a zone has unread memory (new entries since last viewed), show a subtle glow or notification badge on the building sprite
8. **Clear memory**: Per-agent and per-zone clear buttons in the memory viewer

**Files touched**: `graph.py`, `main.py`, `tools.py` (to hook tool outputs), `AgentCard.tsx`, `Sidebar.tsx`, `zones.json`, `VillageScene.ts`, `AgentRegistry.ts`
**New files**: `backend/memory/` (directory tree), tilemap asset for Library building

---

## 2. Saveable Teams

**Goal**: After a run, the user can save the current team (agents YAML, tasks YAML, delegation plan). Saved teams persist and can be reloaded from the onboarding flow.

### Current State
- Team config is assembled in `TeamPlanScreen.tsx` → sent to `PUT /agents/setup`
- YAML files (`agents.yaml`, `tasks.yaml`, `delegation_plan.yaml`) are overwritten each run
- No concept of named/saved teams

### Implementation Plan

**Backend**:
1. **Teams storage directory**: `backend/teams/{team_slug}/` containing:
   - `agents.yaml`
   - `tasks.yaml`
   - `delegation_plan.yaml`
   - `meta.json` (name, created_at, last_used, description)
   - `agent_memories/` (per-team agent memory, see Feature 1)
2. **REST endpoints**:
   - `POST /teams` — save current config as a named team
   - `GET /teams` — list all saved teams
   - `GET /teams/{slug}` — load a team's full config
   - `DELETE /teams/{slug}` — delete a saved team
   - `POST /teams/{slug}/load` — set the active YAML files from a saved team

**Frontend**:
3. **Team picker step in onboarding**: Before `TeamPlanScreen`, add a `TeamSelectScreen` with two paths:
   - "Load saved team" — shows cards for each saved team with name, description, agent count
   - "Create new team" — continues to existing `TeamPlanScreen`
4. **Save team button**: After a successful run (or on the main view), show a "Save Team" button that prompts for a name and calls `POST /teams`
5. **Update `App.tsx` step flow**: `login → avatars → team-select → team (new) | confirm (loaded) → main`

**Files touched**: `main.py`, `App.tsx`, `TeamPlanScreen.tsx`
**New files**: `backend/teams/` (directory), `src/components/onboarding/TeamSelectScreen.tsx`

---

## 3. Mid-Run Agent Interruption

**Goal**: The user can stop an agent mid-execution to provide feedback or reprompt, not just at gate checkpoints.

### Current State
- Agents can only be interrupted at gate checkpoints after task completion (`interrupt()` in `graph.py:191`)
- No mechanism to pause a running `create_react_agent` mid-tool-loop
- WebSocket streams events but has no inbound "stop" channel during a run

### Implementation Plan

**Backend**:
1. **Cancellation signal**: Add an `asyncio.Event` per run (in `_active_runs` dict) that can be set via a REST endpoint to signal cancellation
2. **REST endpoint**: `POST /runs/{id}/interrupt` with body `{"agent_id": "...", "feedback": "..."}` — sets the cancel event and stores the feedback
3. **Cooperative check in worker**: Wrap the `react_agent.ainvoke()` call with a check — after each tool call event in `astream_events`, check the cancel flag. If set, break out of the agent loop early
4. **Re-invocation with feedback**: After interruption, re-enter the worker node with the user's feedback prepended to the task description (similar to how gate feedback works today)
5. **Alternative — LangGraph `interrupt()` mid-stream**: Investigate whether LangGraph supports injecting an `interrupt()` into a running subgraph. If so, this is cleaner than cooperative cancellation

**Frontend**:
6. **Stop button per agent**: In `AgentCard.tsx` or as an overlay on the agent sprite, show a "Stop" button while the agent's status is `active`
7. **Feedback modal**: When the user clicks Stop, show a modal (similar to `GateModal`) where they can type feedback or a new prompt, then call `POST /runs/{id}/interrupt`
8. **WebSocket event**: Emit an `AGENT_INTERRUPTED` event so the frontend can update the agent's visual state (e.g., move sprite to HOUSE zone)

**Files touched**: `graph.py`, `main.py`, `events.py`, `AgentCard.tsx`, `GateModal.tsx` (or new modal), `VillageScene.ts`

---

## 4. Zone Inspection — Tooltips + Memory Viewer

**Goal**: Hovering over a building shows a tooltip with its memory type and recent activity. Clicking opens a detailed panel showing the full memory contents stored in that zone (ties directly into Feature 1's zone-based memory system).

### Current State
- Zone semantics are hardcoded in `VillageScene.ts` and `AgentRegistry.ts` (zone coordinates)
- Events are streamed to `EventFeed.tsx` in the sidebar but not associated with zones
- No hover or click interaction on the Phaser tilemap buildings

### Implementation Plan

**Frontend — Phaser interaction layer**:
1. **Zone hit areas**: In `VillageScene.ts`, define invisible Phaser rectangles over each zone (PARK, HOUSE, CAFE, DORM, WORKSHOP, LIBRARY) using the coordinate constants from `zones.json`
2. **Hover tooltip**: On `pointerover`, show a lightweight Phaser tooltip with:
   - Building name + memory type icon (e.g. Library: book icon, Workshop: hammer icon)
   - One-line summary: "3 research notes from last run" / "2 unread feedback items"
   - Last activity timestamp
3. **Click → Memory panel**: On `pointerdown`, emit a `zone-inspect` event to React with the zone ID. React renders a slide-out panel (or modal) showing:
   - **Library**: Browseable list of research notes, grouped by agent, with search query + result preview
   - **Workshop**: Drafts and artifacts, with syntax highlighting for code, expandable sections
   - **Cafe**: Conversation timeline — who handed off to whom, what context was passed, synthesis output
   - **House**: Feedback history — what the user said, what output it was about, whether the agent improved
   - **Park/Dorm**: Activity log only (no persistent memory — these are transient zones)

**Frontend — Live event log per zone**:
4. **Log buffer**: Maintain a `Map<ZoneId, EventLog[]>` in a new `ZoneLogStore.ts`. WebSocket events are tagged with the zone they map to (using existing event→zone mapping from MEMORY.md) and pushed to the buffer
5. **Dual view**: The zone inspection panel has two tabs: "Memory" (persistent, from Feature 1's backend store) and "Live Log" (ephemeral, from current run's event stream)

**Styling**:
6. Pixel-art themed panels. Building icon + name as header. Memory entries show agent avatar, timestamp, and content preview. Scrollable with search/filter

**Files touched**: `VillageScene.ts`, `AgentRegistry.ts`, `App.tsx` (for React panel layer), `zones.json`
**New files**: `src/phaser/systems/ZoneLogStore.ts`, `src/components/ZoneInspectPanel.tsx`

---

## 5. Multi-Village Map & Agent Marketplace

**Goal**: A world map view with multiple villages. Users can name their village, fork other users' villages, and browse/import teams or individual agents from a marketplace.

### Current State
- Single village, single user, entirely local
- No user accounts, no persistence beyond the local filesystem
- No concept of sharing or remote agent configs

### Implementation Plan

This is the largest feature and requires backend infrastructure beyond the current local-only setup.

**Phase 5A — Local Multi-Village**:
1. **Village data model**: Each village is a directory under `backend/villages/{village_slug}/` containing its `teams/`, `agent_memories/`, and `meta.json` (village name, owner, created_at)
2. **Village selector scene**: A new Phaser scene (`WorldMapScene.ts`) rendered before `VillageScene`. Shows a pixel-art map with the user's village(s) as clickable buildings. "Create New Village" button
3. **Village name in onboarding**: Add a village naming step to the `LoginScreen`
4. **Village switching**: `App.tsx` step flow becomes: `login → world-map → (enter village) → avatars → team-select → ...`

**Phase 5B — Remote Backend & User Accounts**:
5. **Database**: Move from file-based YAML to a database (SQLite for local, Postgres for hosted). Tables: `users`, `villages`, `teams`, `agents`, `agent_memories`, `runs`
6. **Auth**: Add user authentication (OAuth or simple email/password) so villages are owned by users
7. **Village forking**: `POST /villages/{slug}/fork` — deep-copies a village's teams and agents into the current user's account

**Phase 5C — Agent Marketplace**:
8. **Publishing**: Users can mark teams/agents as "public" — stored in a shared `marketplace` table
9. **Marketplace UI**: A new screen/modal showing browseable public teams and agents with search, filters (by category/tools), and "Import" buttons
10. **Import flow**: Importing an agent/team copies the config into the user's village. Agent memories are NOT copied (fresh start)
11. **Ratings/usage stats**: Track how many times a team/agent has been imported, allow ratings

**New infrastructure**: Database, auth, possibly a hosted API if multi-user
**New files**: `WorldMapScene.ts`, `MarketplaceScreen.tsx`, DB migrations, auth middleware

---

## 6. Run Replay / Timeline Scrubber

**Goal**: Store all events for a run and allow "replay mode" — reset the village world state and re-apply events with delays so agents walk through their movements again. A timeline scrubber UI lets the user seek to any point in a past run.

### Current State
- Events stream in real-time via WebSocket and render to `EventFeed.tsx` and `VillageScene.ts`
- Events are not persisted — once the run ends and the page refreshes, they're gone
- No concept of run history or replay

### Implementation Plan

**Backend — Event Persistence**:
1. **Event log per run**: Store all events emitted during a run to `backend/runs/{run_id}/events.jsonl` (one JSON object per line, with timestamp). Write each event as it's emitted in the `astream_events` WebSocket loop in `main.py`
2. **Run metadata**: `backend/runs/{run_id}/meta.json` — run_id, team name, task prompt, start/end time, status, agent list
3. **REST endpoints**:
   - `GET /runs` — list past runs (paginated, most recent first)
   - `GET /runs/{id}/events` — stream or return the full event log for replay
   - `DELETE /runs/{id}` — delete a run's history

**Frontend — Replay Engine**:
4. **Run history panel**: New section in `Sidebar.tsx` or a dedicated `RunHistoryPanel.tsx` showing past runs as cards (task name, date, agent count, duration)
5. **Replay mode**: When the user clicks "Replay" on a past run:
   - Fetch `GET /runs/{id}/events`
   - Reset all agent sprites to PARK (spawn positions)
   - Feed events into `VillageScene.ts` and `AgentRegistry.ts` via the same game event emitters used during live runs, but with configurable delays based on original timestamps
6. **Timeline scrubber**: A horizontal slider UI at the bottom of the screen during replay:
   - Draggable playhead showing current position in the run timeline
   - Play/pause/speed controls (1x, 2x, 4x, 0.5x)
   - Tick marks for major events (task start, gate, task complete)
   - Seeking: jump to any point by dragging — replay engine skips to that event index and applies all prior state
7. **Visual distinction**: During replay, show a "REPLAY" badge and dim the sidebar input controls so the user knows they're watching history, not a live run

**Files touched**: `main.py` (event persistence), `Sidebar.tsx`, `VillageScene.ts`, `AgentRegistry.ts`
**New files**: `backend/runs/` (directory), `src/components/RunHistoryPanel.tsx`, `src/components/TimelineScrubber.tsx`

---

## 7. Dynamic LLM Model Assignment

**Goal**: The leader dynamically assigns different LLM models to different agents based on their responsibilities. A reviewer gets a thinking model, a coder gets Sonnet, a researcher gets Haiku, etc. The cost consumed by each model during a run shows up in the sidebar.

### Current State
- All agents use the same hardcoded model: `claude-sonnet-4-5-20250929` (`graph.py:39`)
- `leader_rules.md` has no guidance on model selection
- No cost tracking whatsoever

### Implementation Plan

**Backend — Model Assignment**:
1. **Model field in agents.yaml**: Add an optional `model` field to each agent's config. If absent, falls back to the default Sonnet
   ```yaml
   reviewer:
     role: QA Reviewer
     model: claude-sonnet-4-5-20250929  # thinking model for deep review
     ...
   coder:
     role: Engineer
     model: claude-sonnet-4-5-20250929   # fast + capable for code
     ...
   researcher:
     role: Researcher
     model: claude-haiku-4-5-20251001    # cheap + fast for lookups
     ...
   ```
2. **Leader rules update**: Add a new section to `leader_rules.md` — "Model Assignment Guidelines":
   - **Thinking model** (`claude-sonnet-4-5-20250929` with extended thinking): Reviewers, QA, architects — agents that need deep reasoning, verification, or catching subtle bugs
   - **Sonnet** (`claude-sonnet-4-5-20250929`): Engineers, writers, strategists — agents doing substantial creative/technical work
   - **Haiku** (`claude-haiku-4-5-20251001`): Researchers, fact-checkers, data gatherers — agents doing simpler lookup/summarization tasks
   - Leader should justify model choices in the delegation plan
3. **Planner outputs model**: Update `planner.py` so the leader's structured tool output includes a `model` field per agent. Update the Pydantic schemas accordingly
4. **Graph uses per-agent model**: In `make_worker_node()`, read `agent_config.get("model", _MODEL)` instead of the global `_MODEL` constant when creating `ChatAnthropic`

**Backend — Cost Tracking**:
5. **Token counting**: After each `react_agent.ainvoke()` call, extract token usage from the response metadata (LangChain's `ChatAnthropic` returns `usage_metadata` on responses). Record `{agent_id, model, input_tokens, output_tokens}`
6. **Cost calculation**: Maintain a pricing table (per-model $/1K tokens) and compute cost per agent per run. Store in run state or emit as an event
7. **Cost event**: Emit a new `COST_UPDATE` WebSocket event after each agent completes:
   ```json
   {"type": "COST_UPDATE", "agent_name": "Reviewer", "model": "claude-sonnet-4-5-20250929", "input_tokens": 3420, "output_tokens": 1280, "cost_usd": 0.034}
   ```
8. **REST endpoint**: `GET /runs/{id}/cost` — returns total and per-agent cost breakdown

**Frontend — Cost Display**:
9. **Cost badge per agent**: In `AgentCard.tsx`, show a small cost indicator (e.g., "$0.03") and the model name/icon next to each agent
10. **Run cost summary**: In `Sidebar.tsx`, show a running total cost for the current run at the top, updating in real-time as `COST_UPDATE` events arrive
11. **Model indicator**: Show which model each agent is using — icon or colored badge (e.g., purple for thinking, blue for Sonnet, green for Haiku)

**Files touched**: `graph.py`, `main.py`, `planner.py`, `leader_rules.md`, `events.py`, `AgentCard.tsx`, `Sidebar.tsx`
**New files**: `backend/pricing.py` (model cost table + calculator)

---

## 8. Customizable & Evolving Village

**Goal**: The village layout is not just decorative — it **is** the workflow configuration. Where buildings sit relative to each other and to the House determines how agents behave: how often they check in, how much they collaborate, how autonomous they are. The village evolves organically over time based on usage patterns, and users can customize the layout to shape their team's workflow.

### The Core Insight: Layout = Behavior

The spatial relationships between buildings map directly to agent pipeline parameters:

| Spatial Property | What It Controls |
|---|---|
| Distance from House to a building | Gate frequency for that phase (closer = more human checkpoints) |
| Distance between Workshop and Cafe | Iteration tightness (closer = agents share intermediate work more often) |
| Distance between Library and Workshop | Research-to-execution coupling (closer = agents reference research more during work) |
| Building size (visual tier) | Resource allocation — larger buildings get higher token budgets or better models |
| Path existence between two buildings | Explicit dependency edge — agents can hand off between connected buildings |
| Overall village radius | Global autonomy dial — compact village = tight oversight, spread = autonomous |

**Example village personalities:**

```
THE OBSERVATORY (centered on House)     THE FACTORY (centered on Workshop)
┌─────────────────────┐                 ┌─────────────────────┐
│    Library  Cafe     │                 │  Library             │
│       \   /          │                 │     \                │
│       HOUSE          │                 │    Workshop ─── Cafe │
│       /   \          │                 │     /                │
│  Workshop  Dorm      │                 │   House              │
│                      │                 │              Dorm    │
└─────────────────────┘                 └─────────────────────┘
Max oversight, every step               Build-first, minimal gates
gates through the user.                 user only sees final output.

THE SALON (centered on Cafe)            THE PIPELINE (linear)
┌─────────────────────┐                 ┌─────────────────────┐
│  Library  Workshop   │                 │                      │
│       \   /          │                 │ Library → Workshop   │
│       CAFE           │                 │     → Cafe → House   │
│       /   \          │                 │              → Dorm  │
│    House   Dorm      │                 │                      │
└─────────────────────┘                 └─────────────────────┘
Collaboration-heavy, agents             Sequential phases, each
constantly share and iterate.           feeds into the next.
```

### How Layout Maps to Real Config

The backend reads the village layout and computes derived parameters that feed into `gate_policy.py` and `graph.py`:

```python
# Pseudocode: layout_to_config()
def layout_to_config(layout: VillageLayout) -> WorkflowConfig:
    house = layout.zones["HOUSE"]

    # 1. Per-zone gate frequency
    #    Normalized distance from House (0.0 = on top of House, 1.0 = max distance)
    for zone in layout.zones:
        d = distance(house, zone) / layout.max_radius
        zone.gate_probability = 1.0 - d  # close to House = gate more often

    # 2. Global autonomy score (average distance from House)
    avg_dist = mean(distance(house, z) for z in layout.zones)
    config.autonomy = avg_dist / layout.max_radius  # 0.0=micromanaged, 1.0=fully autonomous

    # 3. Collaboration intensity (inverse of avg inter-building distance)
    avg_spacing = mean(distance(a, b) for a, b in all_pairs(layout.zones))
    config.collaboration = 1.0 - (avg_spacing / layout.max_radius)

    # 4. Path-based dependencies
    #    If a path exists between Library→Workshop, research output is injected into work context
    config.explicit_deps = layout.paths  # [(source_zone, target_zone), ...]

    return config
```

This means rearranging buildings **actually changes how agents run**:
- Drag House to the center → agents gate more often (STRICT-like behavior without changing the mode dropdown)
- Push House to the edge → agents run autonomously (AUTO-like)
- Pull Library close to Workshop → research notes are always injected into work context
- Disconnect Cafe from everything → agents don't share intermediate work

### Current State (Constraints)
- The tilemap `the_ville_jan7.json` is a 140x100 pre-baked Tiled map (4480x3200px) with buildings embedded in multiple tile layers (Interior Ground, Wall, Interior Furniture L1/L2)
- Zone positions are hardcoded in `zones.json` as pixel coordinates
- Building visuals are part of the tilemap layers — they can't be moved without either re-authoring the tilemap or overlaying separate sprites
- `gate_policy.py` uses a simple mode enum (STRICT/BALANCED/AUTO) with no spatial awareness
- Movement system (`movement.ts`) just moves agents toward target (x,y) at constant speed

### Implementation Plan

#### Phase 8A — Layout Presets (Foundation)

Start with pre-made layouts rather than free-form drag. This avoids the tilemap problem entirely — each preset is a different `zones.json` + camera position.

1. **Layout config file**: Replace static `zones.json` with `village_layout.json`:
   ```json
   {
     "preset": "balanced",
     "zones": {
       "HOUSE": { "x": 3488, "y": 1056 },
       "WORKSHOP": { "x": 2464, "y": 1504, "options": [...] },
       "CAFE": { "x": 2528, "y": 800 },
       "LIBRARY": { "x": 2100, "y": 800 },
       "PARK": { "x": 2912, "y": 1056 },
       "DORM": { "x": 3840, "y": 1600 }
     },
     "paths": [
       ["LIBRARY", "WORKSHOP"],
       ["WORKSHOP", "CAFE"],
       ["CAFE", "HOUSE"]
     ],
     "derived": {
       "autonomy": 0.55,
       "collaboration": 0.4,
       "zone_gate_weights": { "WORKSHOP": 0.3, "CAFE": 0.1, "LIBRARY": 0.0 }
     }
   }
   ```
2. **Preset library**: 4-5 pre-made layouts, each with its own zone coordinates that map onto the existing tilemap (since the map has multiple building areas, we can reassign which area is which zone):
   - **Balanced** (default — current layout)
   - **Observatory** (House-centered, tight cluster)
   - **Factory** (Workshop-centered, House far away)
   - **Salon** (Cafe-centered, everything close to Cafe)
   - **Pipeline** (linear arrangement)
3. **Layout picker in onboarding**: Add a step between team creation and entering the village where the user picks a layout preset. Show a mini-map preview of each layout with a 1-line description of its workflow style
4. **Backend reads layout**: `gate_policy.py` reads `village_layout.json` instead of just the mode enum. `should_gate_task_complete()` now factors in the zone-specific gate weight computed from building distances
5. **Persist per-village**: Layout choice is saved with the village/team config (ties into Feature 2 — Saveable Teams)

**Files touched**: `zones.json` → `village_layout.json`, `gate_policy.py`, `graph.py`, `AgentRegistry.ts`, `VillageScene.ts`
**New files**: `src/components/onboarding/LayoutPickerScreen.tsx`, `backend/layout_engine.py`

#### Phase 8B — Drag-to-Customize

Once presets work, add the ability to drag buildings to custom positions.

6. **Separate buildings from tilemap**: The key architectural change. Instead of buildings being baked into tilemap layers, create building sprites as separate Phaser GameObjects placed **on top of** the base terrain. This requires:
   - A "terrain-only" tilemap (or just use the existing one as-is with buildings as part of the backdrop)
   - Building sprite groups: small pixel-art building images (Library, Workshop, Cafe, House, Dorm) rendered as independent Phaser sprites at the zone coordinates
   - Zone hit-areas still defined by building sprite positions
7. **Edit mode**: A toggle button (pencil icon) that enters "village editor" mode:
   - Buildings become draggable (Phaser `setInteractive` + `drag` events)
   - A grid overlay appears showing valid placement positions
   - Drag a building → updates `village_layout.json` → recomputes derived workflow params
   - Show real-time feedback: "Moving Workshop closer to House increases gate frequency to 60%"
   - A "derived config" panel shows the current autonomy/collaboration scores updating live as buildings move
8. **Snap-to-grid**: Buildings snap to a tile grid (32px increments) for clean alignment
9. **Path editor**: In edit mode, click two buildings to draw/remove a path between them. Paths render as visible dirt-road sprites on the terrain
10. **Save layout**: On exit from edit mode, persist to `village_layout.json` and push to backend via `PUT /village/layout`

**Files touched**: `VillageScene.ts`, `AgentRegistry.ts`, `App.tsx` (edit mode toggle)
**New files**: Building sprite assets, `src/phaser/systems/VillageEditor.ts`

#### Phase 8C — Organic Evolution

The village changes visually over time based on usage patterns. This is the "game feel" layer.

11. **Building experience system**: Each zone accumulates XP based on usage:
    - **Library XP**: +1 per web_search call, +2 per web_scraper call
    - **Workshop XP**: +1 per tool_call, +3 per completed task artifact
    - **Cafe XP**: +2 per agent handoff, +3 per synthesis
    - **House XP**: +5 per gate interaction (feedback is valuable)
    - Store XP in `village_layout.json` per zone
12. **Visual tiers**: Buildings visually upgrade based on XP thresholds:
    - **Tier 1** (0-20 XP): Small shack / tent — simple pixel sprite
    - **Tier 2** (20-100 XP): Cottage — slightly larger, more detail
    - **Tier 3** (100+ XP): Grand building — full-size, decorated, maybe animated (smoke from chimney, light in windows)
    - Each tier is a different sprite asset. Swap the building sprite when XP crosses a threshold
13. **Worn paths**: Track how often agents travel between each pair of zones. Render paths as ground-level sprites:
    - 0-10 trips: No visible path (grass)
    - 10-50 trips: Faint dirt trail (semi-transparent path sprite)
    - 50+ trips: Well-worn road (full opacity, wider)
    - This gives the user a visual record of their team's workflow patterns
14. **Village mood / vitality**: Aggregate stats across runs affect the village ambiance:
    - High success rate (user approves most gates, runs complete without errors): Lush greenery, flowers appear, birds, warm lighting
    - Low success rate: More muted colors, bare trees
    - Implement via a Phaser post-processing tint or by swapping terrain tile layers
15. **Emergent building placement**: After N runs, if the derived config consistently shows a pattern (e.g., Library XP is 3x Workshop XP), suggest moving Library closer to the center: "Your team does a lot of research. Consider moving the Library closer to the Workshop for tighter research-to-execution loops." This nudges the village toward a layout that matches the user's actual workflow
16. **New buildings unlock**: After accumulating enough XP in a category, new specialized buildings can appear:
    - **Testing Lab** (100+ Workshop XP): Appears near Workshop. Dedicated zone for QA/review agents. Agents in this zone get extra scrutiny tools
    - **Archive** (100+ Library XP): Long-term memory store. Older Library memories graduate here instead of being truncated
    - **Town Hall** (100+ Cafe XP): Enhanced collaboration zone. Agents meeting here can see each other's full context, not just summaries

#### Phase 8D — Layout Affects Agent Behavior (Deep Integration)

The final layer: layout doesn't just set gate frequency — it shapes the agent's actual prompting and tool access.

17. **Zone proximity → context injection**: If Library is close to Workshop (normalized distance < 0.3), worker agents automatically get their Library memory injected into the system prompt. If far away, they only get it if they explicitly use `web_search`. This means layout controls how much "institutional knowledge" agents have access to during work
18. **Collaboration radius**: Agents in buildings within a certain pixel radius of each other can "hear" each other's outputs in real-time (streamed via Cafe memory). Outside that radius, they only see outputs after task completion. This turns physical proximity into information proximity
19. **Building size → token budget**: Tier 3 buildings grant agents working in that zone a higher `max_tokens` (e.g., 8192 instead of 4096). Smaller buildings = agents must be more concise. This creates a natural resource allocation system — invest in the zones that matter most
20. **House proximity → feedback granularity**: When the House is close to a building, gate prompts are more detailed ("Here's the full output, please review each section"). When far, gates are brief ("Agent finished. Approve?"). This maps physical closeness to the depth of human review

### Value Proposition

This feature transforms Panopticon from "a UI for running agent pipelines" into "a game where your village reflects your team's working style." The value layers:

1. **Intuitive workflow design**: Non-technical users can configure complex agent pipelines by dragging buildings instead of editing YAML. "I want more oversight" = drag House to center
2. **Emergent personality**: Each user's village becomes unique over time, reflecting their usage patterns. Worn paths, upgraded buildings, and village mood make the tool feel alive
3. **Visual feedback loop**: Users can *see* that their team does too much research and not enough execution (Library is Tier 3, Workshop is Tier 1) and adjust accordingly
4. **Gamification without gimmicks**: Building upgrades and path evolution are meaningful (they reflect real usage) rather than arbitrary achievements. The "game" is actually configuring your AI team
5. **Shareability** (ties into Feature 5): When villages are shareable, the layout itself encodes workflow knowledge. Forking someone's village gives you their workflow configuration, not just their agent definitions

**Files touched**: `gate_policy.py`, `graph.py`, `main.py`, `VillageScene.ts`, `AgentRegistry.ts`, `movement.ts`, `zones.json`
**New files**: `backend/layout_engine.py`, `backend/village_xp.py`, `src/phaser/systems/VillageEditor.ts`, `src/components/onboarding/LayoutPickerScreen.tsx`, building tier sprite assets (3 tiers x 6 buildings = 18 sprites)

---

## 9. Expanded Tooling & Tool-Zoned Buildings

**Goal**: Dramatically expand the tools available to agents and tie each tool category to a specific building. When an agent uses a tool, their sprite physically walks to the building that houses it. Buildings become visible **capability workshops** — the village layout is a capability map, and you can watch your agents work by seeing which buildings they visit.

### The Core Mechanic: Buildings House Tools

Currently all tool calls happen at WORKSHOP and are visually identical. The new model:

| Building | Zone ID | Tool Category | Tools Housed |
|----------|---------|---------------|-------------|
| Library | `LIBRARY` | Research & knowledge | `web_search`, `web_scraper`, `arxiv_search`, `wikipedia`, `vector_search` |
| Workshop | `WORKSHOP` | Creation & writing | `file_writer`, `file_reader`, `list_input_files`, `markdown_to_pdf`, `image_generator` |
| Forge | `FORGE` | Code execution | `terminal`, `python_repl`, `git_status`, `linter`, `test_runner` |
| Observatory | `OBSERVATORY` | Data & analysis | `data_analyzer`, `chart_generator`, `api_client`, `json_transform` |
| Post Office | `POST_OFFICE` | Communication & output | `email_sender`, `slack_poster`, `webhook`, `notification` |
| Cafe | `CAFE` | Collaboration | (no tools — agent-to-agent handoffs only) |
| House | `HOUSE` | User interaction | (no tools — gates and feedback only) |

When an agent calls `web_search`, they walk to the **Library**. When they call `python_repl`, they walk to the **Forge**. When they call `file_writer`, they walk to the **Workshop**. The visual result: you can literally *see* what your agents are doing by watching where they go.

### New Tools (by building)

**Library — Research & Knowledge**:
| Tool | Description | Needs API Key | Gated |
|------|-------------|---------------|-------|
| `web_search` | (existing) Serper web search | SERPER_API_KEY | No |
| `web_scraper` | (existing) Fetch & extract URL content | No | No |
| `arxiv_search` | Search arXiv for academic papers by keyword, return abstracts + PDF links | No | No |
| `wikipedia` | Structured Wikipedia article lookup with section extraction | No | No |
| `vector_search` | Semantic search across the village's accumulated memory (Feature 1 store). Uses embeddings to find relevant past research, work artifacts, or feedback | No | No |

**Forge — Code Execution**:
| Tool | Description | Needs API Key | Gated |
|------|-------------|---------------|-------|
| `terminal` | (existing) Sandboxed shell commands | No | Yes |
| `python_repl` | Execute Python code in an isolated subprocess. Returns stdout + stderr. Has access to workspace files but not the host system. More powerful than terminal — supports multi-line scripts, imports, file I/O within sandbox | No | Yes |
| `git_status` | Read-only git operations: `status`, `diff`, `log`, `show`. No push/pull/commit | No | No |
| `linter` | Run linting/formatting checks on a file (ruff for Python, eslint for JS). Returns issues found | No | No |
| `test_runner` | Execute test files (pytest, jest) in sandbox. Returns pass/fail + output | No | Yes |

**Observatory — Data & Analysis**:
| Tool | Description | Needs API Key | Gated |
|------|-------------|---------------|-------|
| `data_analyzer` | Load CSV/JSON data and run pandas operations (describe, filter, groupby, pivot). Returns results as formatted tables | No | No |
| `chart_generator` | Generate matplotlib/seaborn charts from data. Saves PNG to workspace/output and returns the file path | No | No |
| `api_client` | Make HTTP requests to external APIs (GET/POST). Returns response body. Allowlist-based URL filtering for safety | No | Yes |
| `json_transform` | Parse, query (JSONPath/jq-style), and transform JSON data. Useful for reshaping API responses or data files | No | No |

**Post Office — Communication & Output**:
| Tool | Description | Needs API Key | Gated |
|------|-------------|---------------|-------|
| `email_sender` | Send emails via SMTP or SendGrid. Subject, body, recipients. Always gated | SENDGRID_API_KEY | Always |
| `slack_poster` | Post messages to a Slack channel via webhook URL | SLACK_WEBHOOK_URL | Always |
| `webhook` | Fire a POST request to a configured webhook endpoint with a JSON payload | No | Always |
| `notification` | Send an in-app notification to the user (shows up in sidebar). Useful for agents to flag things that don't need a full gate | No | No |

**Workshop — Creation & Writing** (existing tools, reorganized):
| Tool | Description | Needs API Key | Gated |
|------|-------------|---------------|-------|
| `file_writer` | (existing) Write files to workspace/output | No | Yes |
| `file_reader` | (existing) Read files from workspace/input | No | No |
| `list_input_files` | (existing) List available input files | No | No |
| `markdown_to_pdf` | Convert a markdown file to PDF using pandoc or weasyprint | No | No |
| `image_generator` | Generate images via DALL-E or Stable Diffusion API. Saves to workspace/output | OPENAI_API_KEY | Yes |

### Current State
- 6 tools total: `web_search`, `web_scraper`, `terminal`, `file_reader`, `list_input_files`, `file_writer` (`tools.py`)
- All tool calls visually happen at WORKSHOP — the `AGENT_ACTIVITY` event with `activity: "tool_call"` doesn't move the agent to a tool-specific zone
- `leader_rules.md` section 3 only lists 4 tools for the leader to assign
- `TOOL_REGISTRY` in `tools.py` is flat — no concept of categories or buildings
- The `translate_event()` function in `main.py` emits `toolName` on `on_tool_start` events, but the frontend ignores it for zone routing

### Implementation Plan

#### Phase 9A — Tool-to-Zone Routing (visual only, no new tools)

Make existing tool calls route agents to the correct building. This is the smallest change with the biggest visual impact.

1. **Tool-zone mapping**: Add a `TOOL_ZONE_MAP` constant (either in `tools.py` or a new `tool_zones.py`):
   ```python
   TOOL_ZONE_MAP = {
       "web_search": "LIBRARY",
       "web_scraper": "LIBRARY",
       "terminal": "FORGE",
       "file_reader": "WORKSHOP",
       "list_input_files": "WORKSHOP",
       "file_writer": "WORKSHOP",
   }
   ```
2. **Emit zone in AGENT_ACTIVITY**: In `translate_event()` (`main.py:194-205`), when emitting an `AGENT_ACTIVITY` event for `on_tool_start`, include a `zone` field:
   ```python
   results.append({
       "type": "AGENT_ACTIVITY",
       "agentName": agent_name,
       "activity": "tool_call",
       "details": f"Using {tool_name}",
       "toolName": tool_name,
       "zone": TOOL_ZONE_MAP.get(tool_name, "WORKSHOP"),
   })
   ```
3. **Frontend routes agent to building**: In `VillageScene.ts`, when an `AGENT_ACTIVITY` event has `activity === "tool_call"`, move the agent to the zone specified in the event instead of keeping them at WORKSHOP:
   ```typescript
   } else if (ev.type === "AGENT_ACTIVITY") {
     this.agentRegistry.setActivity(ev.agentName, ev.activity, ev.details);
     if (ev.activity === "tool_call" && ev.zone) {
       this.agentRegistry.setTarget(ev.agentName, ev.zone);
     }
   }
   ```
4. **Add LIBRARY and FORGE zones**: Add coordinates to `zones.json` for the two new buildings. Map them to existing buildings on the tilemap that are currently unused (the map has many buildings — we just need to pick two and assign them)

**Files touched**: `main.py`, `tools.py` (or new `tool_zones.py`), `VillageScene.ts`, `zones.json`

#### Phase 9B — Expanded Tool Registry

Add the new tools themselves.

5. **Tool category system**: Restructure `TOOL_REGISTRY` to include categories:
   ```python
   TOOL_REGISTRY = {
       "web_search": {
           "id": "web_search",
           "label": "Web Search",
           "category": "research",      # NEW
           "zone": "LIBRARY",           # NEW
           "gated": False,              # NEW — does this tool require gate approval?
           "description": "...",
           "env_key": "SERPER_API_KEY",
           "factory": lambda: web_search,
       },
       # ...
   }
   ```
6. **Implement Tier 1 tools** (no external dependencies):
   - `python_repl`: Similar to existing `terminal` but runs Python scripts directly. Uses `subprocess.run(["python", "-c", code])` with workspace sandboxing
   - `data_analyzer`: Wraps `python_repl` with pandas pre-imported. Takes a CSV path + operation description, generates and executes pandas code
   - `chart_generator`: Wraps `python_repl` with matplotlib. Takes data + chart spec, generates and saves PNG
   - `git_status`: Read-only git wrapper. Runs `git status`, `git diff`, `git log` via subprocess
   - `json_transform`: Pure Python JSONPath evaluation on input data
   - `wikipedia`: Uses the `wikipedia` PyPI package or direct MediaWiki API calls
   - `arxiv_search`: HTTP call to arXiv API, parse XML response
   - `notification`: Emits a WebSocket event to the frontend (no external service needed)
   - `vector_search`: Uses the zone memory store from Feature 1. Embeds the query, searches against stored memory embeddings. Requires an embedding model (could use Anthropic or local)
7. **Implement Tier 2 tools** (need API keys):
   - `api_client`: `httpx` wrapper with URL allowlist. Configurable via env or settings
   - `email_sender`: SendGrid or SMTP wrapper
   - `slack_poster`: Simple webhook POST
   - `image_generator`: OpenAI DALL-E API call
8. **Update `leader_rules.md`**: Expand section 3 (Tooling) to list all available tools organized by building/category. Add guidance on when to assign each:
   ```markdown
   ## 3) Tooling

   Tools are organized by building. Assign tools that match the agent's role.

   ### Library (Research)
   - `web_search` — quick fact lookups, recent events, stats
   - `web_scraper` — read specific URLs the agent already has
   - `arxiv_search` — academic paper search (for research-heavy tasks)
   - `wikipedia` — encyclopedic knowledge lookup
   - `vector_search` — search the team's accumulated memory

   ### Forge (Code)
   - `python_repl` — execute Python scripts (for engineers, data analysts)
   - `terminal` — sandboxed shell (for DevOps, system tasks)
   - `git_status` — read git state (for code reviewers)
   - `linter` — check code quality
   - `test_runner` — run tests

   ### Workshop (Creation)
   - `file_writer` — write output files
   - `file_reader` / `list_input_files` — read input files

   ### Observatory (Data)
   - `data_analyzer` — pandas operations on structured data
   - `chart_generator` — create visualizations

   ### Post Office (Communication) — always gated
   - `email_sender`, `slack_poster`, `webhook`
   ```

#### Phase 9C — Building as Capability Gate

The village layout controls which tools are available.

9. **Building presence = tool access**: If a building doesn't exist in the village layout (Feature 8), the tools it houses are unavailable. Example: remove the Forge from your village → agents can't use `terminal`, `python_repl`, etc. This makes village customization a **security and capability control mechanism**
10. **Building lock/unlock UI**: In the village editor (Feature 8B), buildings can be toggled locked/unlocked. A locked building is grayed out and its tools are disabled. The lock state persists in `village_layout.json`:
    ```json
    {
      "zones": {
        "FORGE": { "x": 2100, "y": 1400, "locked": true },
        "POST_OFFICE": { "x": 3200, "y": 800, "locked": false }
      }
    }
    ```
11. **Tool approval per building**: Buildings marked as `"gated": true` in the layout require user approval before any tool in that category executes. This integrates with `gate_policy.py` — the gate check happens at the building level, not just the tool level. Currently only `terminal` and `file_writer` are gated (`gate_policy.py:56-60`); this generalizes it
12. **Building capacity**: Optionally, a building can have a max concurrent agent count. If 3 agents are already at the Forge, a 4th agent must wait (visually queuing outside). This prevents resource contention and adds a natural bottleneck visualization

#### Phase 9D — Visual Polish

13. **Building-specific activity icons**: Replace the generic hammer emoji for tool calls with building-specific icons:
    - Library: magnifying glass or book
    - Forge: gear or terminal cursor
    - Observatory: chart or telescope
    - Workshop: pencil or document
    - Post Office: envelope
14. **Tool output in building memory**: When an agent uses a tool at a building, the tool's input/output is stored in that building's memory (ties into Feature 1). Library accumulates search results, Forge accumulates code execution logs, etc. This means buildings get smarter over time
15. **Worn paths from tool usage**: Agent travel to buildings creates worn paths (ties into Feature 8C). If agents frequently travel Library → Forge (research then code), that path becomes visible. This gives the user a visual record of the team's workflow patterns

### Value of This Feature

1. **Visibility**: Instead of all work happening in an invisible WORKSHOP black box, you can *see* the different phases of work. "Oh, my researcher is at the Library, my coder is at the Forge, and my reviewer is walking to the Observatory to check the data"
2. **Capability control**: Buildings = permissions. Lock the Post Office to prevent agents from sending emails. Remove the Forge to keep agents from running code. This is security through spatial design
3. **Natural tool discovery**: New users can click on buildings to see what tools are available there, rather than reading a flat tool list. The spatial metaphor makes capabilities intuitive
4. **Workflow visualization**: Worn paths between buildings show your team's actual workflow. Heavy Library→Forge traffic means your team does research-driven development. Heavy Workshop→Post Office traffic means your team produces content and distributes it
5. **Tool expansion framework**: Adding a new tool is just: implement it, add it to `TOOL_REGISTRY` with a `zone` field, and it appears in the right building. No other changes needed

**Files touched**: `tools.py`, `main.py`, `graph.py`, `gate_policy.py`, `leader_rules.md`, `VillageScene.ts`, `AgentRegistry.ts`, `zones.json`
**New files**: `backend/tool_zones.py` (mapping), new tool implementations in `tools.py` (or split into `tools/` package), building sprite assets for Forge/Observatory/Post Office

---

## 10. Skip Interview — Auto-Generate Team from Task

**Goal**: The user can bypass the leader's multi-turn interview and get a team generated instantly from just their task description. One click, zero questions.

### Current State
- `plan_team()` in `planner.py` uses a multi-turn tool-calling loop: the leader calls `ask_question` 4-8 times before calling `create_team_files`
- Each question requires a round-trip: backend → frontend → user types answer → backend. This takes 2-5 minutes for a full interview
- `_build_conversation_context()` (`planner.py:164-192`) drives the interview by telling the leader how many questions it's asked and whether to keep asking or finalize
- The frontend `TeamPlanScreen.tsx` has three phases: `input` → `chatting` → `review`. The chatting phase is the interview
- Templates already exist as a zero-question path (`handleApplyTemplate`), but they're static and don't adapt to the task description

### Implementation Plan

**Backend**:
1. **New endpoint or mode flag**: Add a `skip_interview: bool` field to the `POST /plan-team` request body. When `true`, the planner skips the interview entirely
2. **Modified system prompt**: When `skip_interview=true`, replace the interview instructions in the leader's system prompt with:
   ```
   The user wants a team generated instantly with NO interview.
   Based ONLY on their task description below, use create_team_files
   to generate the best team immediately. Do NOT use ask_question.
   Infer the team composition, roles, and tools from the task description alone.
   ```
   This is a one-shot call: the leader gets the task description and must call `create_team_files` on the first turn
3. **Update `_build_conversation_context()`**: When `skip_interview=true`, skip the "This is the first interaction. Start by asking..." prompt and instead say: "Generate the team NOW using create_team_files. Do not ask any questions."
4. **Fallback**: If the leader still calls `ask_question` despite the instruction (LLMs sometimes do), catch it and auto-respond with "Please just create the team based on the task description" and re-invoke

**Frontend**:
5. **Quick mode toggle on TeamPlanScreen**: On the `input` phase, add a toggle or second button next to "Plan My Team":
   ```
   [  Plan My Team  ]     ← starts interview (existing)
   [  Auto-Generate  ]    ← skip interview, instant team
   ```
   Or a simpler approach: a checkbox "Skip interview — generate team instantly" below the task description textarea
6. **Loading state**: When auto-generating, skip the `chatting` phase entirely. Show a loading spinner with "{leaderAvatar.name} is building your team..." and jump straight to `review` when the backend returns
7. **Flow**: `input` → (loading) → `review`. The user sees the generated team and can still edit agents, add/remove, change tools before entering the village

**UX Considerations**:
8. **When to recommend each mode**:
   - **Interview**: When the user's task description is vague ("I need a team"), or when they want fine-grained control over agent specializations
   - **Auto-generate**: When the task description is specific ("Build a content marketing team that creates blog posts with SEO optimization and social media distribution"), or when the user just wants to get started fast
9. **Hint text**: Below the auto-generate button, show: "Best for specific task descriptions. You can still edit the team before entering."
10. **Remember preference**: Store the user's last choice (interview vs auto) in localStorage so returning users get their preferred flow by default

**Files touched**: `planner.py` (new mode flag + modified prompt), `main.py` (accept `skip_interview` param), `TeamPlanScreen.tsx` (toggle + skip chatting phase)

---

## 11. Framework-Agnostic Backend (Multi-Framework Support)

**Goal**: Panopticon's village UI should work with **any** multi-agent framework — not just LangGraph. Users should be able to plug in CrewAI, AutoGen, OpenAI Swarm, custom agent loops, or any future framework, and the village visualizes it the same way.

### Current Coupling Points

The backend is deeply coupled to LangGraph + LangChain in three layers:

| Layer | What's coupled | Where |
|-------|---------------|-------|
| **Orchestration** | `StateGraph`, `START`/`END`, `create_react_agent`, `MemorySaver`, `interrupt()`/`Command(resume=)` | `graph.py` — the entire file |
| **Event translation** | `astream_events(v2)` event kinds (`on_chain_start`, `on_chat_model_stream`, `on_tool_start`, `on_tool_end`, `on_chain_end`) mapped to frontend events via `translate_event()` | `main.py:121-230` |
| **LLM & tools** | `ChatAnthropic`, `langchain_core.tools.tool` decorator, `bind_tools()`, `with_structured_output()` | `graph.py`, `planner.py`, `tools.py` |

The frontend is already framework-agnostic — it only consumes the WebSocket event contract (`RUN_STARTED`, `AGENT_INTENT`, `AGENT_ACTIVITY`, `TASK_SUMMARY`, `TASK_HANDOFF`, `GATE_REQUESTED`, `RUN_FINISHED`, `ERROR`). The problem is entirely backend-side.

### Architecture: The Event Contract as the Abstraction Layer

The key insight: **the frontend event contract IS the abstraction**. Any backend that emits these events over WebSocket will work with the village UI. The refactor is about formalizing this contract and making the backend pluggable behind it.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (unchanged)                   │
│  React + Phaser — consumes WebSocket event contract      │
│  RUN_STARTED | AGENT_INTENT | AGENT_ACTIVITY | ...       │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket (same contract)
┌──────────────────────▼──────────────────────────────────┐
│              Panopticon Event Bridge (NEW)                │
│  FastAPI server — receives framework events,             │
│  translates to the standard contract, streams to WS      │
├─────────────┬──────────────┬──────────────┬─────────────┤
│  LangGraph  │   CrewAI     │   AutoGen    │   Custom    │
│  Adapter    │   Adapter    │   Adapter    │   Adapter   │
│  (current)  │              │              │             │
└─────────────┴──────────────┴──────────────┴─────────────┘
```

### Implementation Plan

#### Phase 11A — Formalize the Event Contract

Define the contract as a standalone spec that any adapter must produce.

1. **Event schema file**: Create `backend/contracts/events.py` (or a JSON Schema) that formally defines every event type, its required fields, and their types:
   ```python
   @dataclass
   class RunStartedEvent:
       type: Literal["RUN_STARTED"] = "RUN_STARTED"
       runId: str
       agents: list[str]

   @dataclass
   class AgentActivityEvent:
       type: Literal["AGENT_ACTIVITY"] = "AGENT_ACTIVITY"
       agentName: str
       activity: Literal["idle", "tool_call", "llm_generating", "planning"]
       details: str = ""
       toolName: str | None = None
       zone: str | None = None

   @dataclass
   class GateRequestedEvent:
       type: Literal["GATE_REQUESTED"] = "GATE_REQUESTED"
       gateId: str
       runId: str
       agentName: str
       question: str
       context: str = ""
       # ... etc for all 8 event types
   ```
2. **Contract documentation**: A standalone `docs/event_contract.md` that describes each event, when it should be emitted, and examples. This is the spec an adapter author reads
3. **Contract validation**: A utility function `validate_event(event: dict) -> bool` that checks an event matches the schema. Used in tests and optionally at runtime in the WebSocket handler

#### Phase 11B — Extract the Adapter Interface

Refactor the current LangGraph code into a pluggable adapter.

4. **Adapter base class**: Define `backend/adapters/base.py`:
   ```python
   class AgentFrameworkAdapter(ABC):
       @abstractmethod
       async def build_graph(self, delegation_plan, agents_config, tasks_config, gating_mode) -> Any:
           """Build the execution graph/crew/swarm from config."""

       @abstractmethod
       async def stream_events(self, graph, input_state, config) -> AsyncIterator[dict]:
           """Yield Panopticon event contract events as the run executes."""

       @abstractmethod
       async def resume_after_gate(self, graph, gate_response, config) -> None:
           """Resume execution after a human-in-the-loop gate."""

       @abstractmethod
       def get_framework_name(self) -> str:
           """Return the framework name for display ('LangGraph', 'CrewAI', etc.)."""
   ```
5. **LangGraph adapter**: Move current `graph.py` + `translate_event()` logic into `backend/adapters/langgraph_adapter.py`. It implements `AgentFrameworkAdapter`:
   - `build_graph()` → current `build_execution_graph()`
   - `stream_events()` → wraps `astream_events(v2)` + `translate_event()` into the standard contract
   - `resume_after_gate()` → current `Command(resume=...)` logic
6. **Refactor `main.py`**: The WebSocket handler becomes adapter-agnostic. Instead of directly calling `compiled_graph.astream_events(...)`, it calls `adapter.stream_events(...)`:
   ```python
   adapter = get_active_adapter()  # returns the configured adapter instance
   async for event in adapter.stream_events(graph, input_state, config):
       await websocket.send_text(json.dumps(event))
       # gate handling via adapter.resume_after_gate()
   ```
7. **Adapter selection**: A config option (`AGENT_FRAMEWORK=langgraph` in `.env` or `config.yaml`) determines which adapter is loaded at startup

#### Phase 11C — CrewAI Adapter

Build the first alternative adapter to prove the abstraction works.

8. **CrewAI adapter**: `backend/adapters/crewai_adapter.py`. Maps CrewAI concepts to the Panopticon contract:
   - CrewAI `Crew` → build from agents.yaml/tasks.yaml (similar to how the project started before Phase 3)
   - CrewAI `task_callback` / `step_callback` → emit `AGENT_ACTIVITY`, `TASK_SUMMARY` events
   - CrewAI `human_input=True` → emit `GATE_REQUESTED`, wait for response
   - CrewAI doesn't have native `astream_events`, so the adapter wraps callbacks into an async generator

   Mapping table:
   | CrewAI Callback | Panopticon Event |
   |---|---|
   | `task_started` | `AGENT_INTENT` |
   | `step_callback` (tool use) | `AGENT_ACTIVITY` (tool_call) |
   | `step_callback` (LLM) | `AGENT_ACTIVITY` (llm_generating) |
   | `task_completed` | `TASK_SUMMARY` |
   | `human_input` prompt | `GATE_REQUESTED` |
   | Crew kickoff | `RUN_STARTED` |
   | Crew finished | `RUN_FINISHED` |

9. **Tool bridge**: CrewAI uses its own tool system (`@tool` from `crewai_tools`). The adapter needs a thin bridge that wraps Panopticon's `tools.py` tools into CrewAI-compatible tools, or vice versa. Alternatively, keep tool implementations framework-agnostic (plain Python functions) and wrap them for each framework

#### Phase 11D — AutoGen / OpenAI Swarm / Custom Adapters

10. **AutoGen adapter**: AutoGen uses `ConversableAgent` with message-passing. Map `send`/`receive` events to `AGENT_ACTIVITY` and `TASK_HANDOFF`. AutoGen's `human_input_mode` maps to gates
11. **OpenAI Swarm adapter**: Swarm is simpler — single-agent handoffs. Map `Agent.run()` calls and handoff returns to the event contract
12. **Custom adapter template**: A minimal `backend/adapters/custom_template.py` that shows how to wrap any async Python code into the event contract. For users who don't use a framework at all:
    ```python
    class CustomAdapter(AgentFrameworkAdapter):
        async def stream_events(self, graph, input_state, config):
            yield {"type": "RUN_STARTED", "runId": "...", "agents": [...]}
            # ... your custom agent logic here ...
            # Emit events as you go:
            yield {"type": "AGENT_ACTIVITY", "agentName": "...", ...}
            yield {"type": "RUN_FINISHED", ...}
    ```

#### Phase 11E — Framework Picker UI

13. **Settings page**: A new settings panel (accessible from sidebar or onboarding) where the user selects their agent framework from a dropdown: LangGraph (default), CrewAI, AutoGen, Custom
14. **Framework-specific config**: Each adapter may need its own config (e.g., CrewAI needs `process` type, AutoGen needs `llm_config`). The settings page shows adapter-specific fields
15. **Hot-swap**: Changing frameworks doesn't require a server restart — the adapter is swapped at the next run

### What Stays Framework-Agnostic (Already)

These parts of Panopticon work regardless of framework and need no changes:
- **Frontend**: Everything. React, Phaser, the village, zone logic, event handling — all driven by the WebSocket event contract
- **Tools**: `tools.py` functions are plain Python — they can be wrapped for any framework
- **Gate policy**: `gate_policy.py` is pure logic (mode + booleans → decision). Framework-independent
- **Team planning**: `planner.py` uses LangChain but could be swapped or kept as-is (it only runs during onboarding, not execution)
- **Memory system** (Feature 1): File-based, framework-independent
- **Village layout** (Feature 8): Purely frontend + config files

### What MUST Be Adapted Per Framework

| Concern | Why it's framework-specific |
|---------|---------------------------|
| Graph construction | Each framework has its own DAG/crew/swarm builder |
| Event streaming | Each framework has different callback/streaming APIs |
| Human-in-the-loop | `interrupt()`/`Command` is LangGraph-specific. CrewAI uses `human_input`. AutoGen uses `human_input_mode` |
| Checkpointing | `MemorySaver` is LangGraph-specific. Others may not support mid-run persistence |
| Parallel fan-out | LangGraph does this natively. CrewAI uses `process=Process.parallel`. AutoGen uses `GroupChat` |

### Value

1. **Broader adoption**: Users already invested in CrewAI or AutoGen can use Panopticon without rewriting their agents
2. **Best-of-breed flexibility**: Use LangGraph for complex DAGs, CrewAI for simple crews, custom code for bespoke workflows — same village UI for all
3. **Future-proofing**: New frameworks emerge constantly. The adapter pattern means supporting a new framework is just one new file, not a rewrite
4. **Comparison**: Users can run the same task with different frameworks and compare behavior visually in the village

**Files touched**: `main.py` (refactor WS handler to use adapter), `graph.py` (move to adapter)
**New files**: `backend/adapters/base.py`, `backend/adapters/langgraph_adapter.py`, `backend/adapters/crewai_adapter.py`, `backend/contracts/events.py`, `docs/event_contract.md`

---

## Priority Order

| # | Feature | Complexity | Dependencies |
|---|---------|-----------|--------------|
| 10 | Skip Interview — Auto-Generate Team | Low | None |
| 1 | Zone-Based Memory System | Medium | None (new LIBRARY zone on tilemap) |
| 7 | Dynamic LLM Model Assignment + Cost Tracking | Medium | None |
| 9A | Tool-to-Zone Routing | Low | None (just routing existing tools to buildings) |
| 4 | Zone Inspection (Tooltips + Memory Viewer) | Medium | Feature 1 (reads memory stores) |
| 2 | Saveable Teams | Medium | Feature 1 (memory travels with teams) |
| 9B | Expanded Tool Registry | Medium | Feature 9A (zone routing in place) |
| 3 | Mid-Run Interruption | Medium-High | None (but feedback goes to Feature 1's House memory) |
| 6 | Run Replay / Timeline Scrubber | Medium-High | None (but benefits from Feature 1's zone logs) |
| 11A-B | Framework-Agnostic (contract + adapter interface) | Medium-High | None (but best after core features stabilize) |
| 9C | Building as Capability Gate | Medium | Features 8A, 9B (layout + expanded tools) |
| 8 | Customizable & Evolving Village | High | Features 1, 2, 4, 9A |
| 11C-E | Framework-Agnostic (CrewAI/AutoGen/UI) | High | Feature 11A-B |
| 5 | Multi-Village & Marketplace | High | Features 1, 2, 8 |

Recommended order: **10 → 1 → 7 → 9A → 4 → 2 → 9B → 3 → 6 → 11A-B → 8 → 9C → 11C-E → 5 → 12 → 13 → 14**

Feature 8 is phased internally: **8A (presets)** can ship early alongside Feature 2. **8B (drag-to-customize)** and **8C (evolution)** are the longer tail. **8D (deep behavior integration)** is the final payoff that ties everything together.

Feature 9 is also phased: **9A (routing)** is a quick win that can ship very early. **9B (new tools)** is ongoing. **9C (capability gating)** requires Feature 8.

Feature 11 is phased: **11A-B (contract + adapter refactor)** is the important architectural work. **11C-E (additional adapters + UI)** are incremental after that.

---

## 12. Robust Memory Persistence — Cross-Workflow Context Retention

**Goal**: Agents retain context not just within a single run, but across multi-step workflows and sequential runs. An agent that researched a topic in Run 1 remembers its findings in Run 2 without re-doing the work. Memory is structured, queryable, and scoped — agents carry a persistent "working memory" that survives beyond the run lifecycle.

### How It Differs from Feature 1 (Zone-Based Memory)

Feature 1 gives each **building** a memory store (Library stores research, Workshop stores artifacts). Feature 12 gives each **agent** a persistent identity with structured memory that follows them across runs, teams, and even villages. Zone memory is *where* knowledge lives. Agent memory is *who* knows it.

### Current State
- All agent context is lost when a run ends — `create_react_agent` starts fresh each time
- Gate feedback is appended inline but not persisted (`graph.py:206-208`)
- `MemorySaver` checkpoints exist only for mid-run interrupt/resume, not cross-run persistence
- No embedding store, no retrieval-augmented agent prompting

### Memory Architecture

```
backend/agent_memory/
  {agent_id}/
    profile.json          # Agent identity: role, strengths, preferences learned over time
    episodic/             # Run-by-run memory (what happened)
      run_{id}.md         # Summary of what the agent did, tools used, outcomes
    semantic/             # Factual knowledge (what the agent knows)
      knowledge.jsonl     # Extracted facts, entities, relationships from past work
    procedural/           # How-to knowledge (how the agent works)
      strategies.md       # Successful strategies, failed approaches, learned heuristics
    working/              # Current workflow state (active across a multi-step workflow)
      context.json        # Scratchpad for multi-step workflows — carries forward between runs
```

### Implementation Plan

**Backend — Memory Store**:
1. **Episodic memory**: After each run, generate a structured summary of what the agent did (tasks completed, tools used, key findings, user feedback received). Store as `episodic/run_{id}.md`. Use LLM summarization to compress raw output into concise memory entries
2. **Semantic memory**: Extract factual knowledge from agent outputs using entity extraction. Store as JSONL entries: `{"fact": "...", "source_run": "...", "confidence": 0.9, "timestamp": "..."}`. Queryable by keyword or embedding similarity
3. **Procedural memory**: After gate feedback (especially rejections or corrections), extract a lesson: "When writing blog posts, always include sources" → stored in `strategies.md`. Over time, agents learn from user preferences
4. **Working memory (cross-run scratchpad)**: For multi-step workflows (e.g., "Research → Draft → Review → Publish"), the agent's working context persists between runs. A `context.json` holds the current workflow state, intermediate results, and what still needs to be done. The next run picks up where the last one left off
5. **Memory injection into system prompt**: At agent creation time in `make_worker_node()`, load relevant memories and inject into the system message:
   ```
   ## Your Memory
   ### Recent experience (last 3 runs)
   {episodic summaries}
   ### Things you know
   {top-K relevant semantic facts, retrieved by embedding similarity to current task}
   ### Lessons learned
   {procedural strategies}
   ### Current workflow state
   {working memory context, if part of a multi-step workflow}
   ```
6. **Memory budget & summarization**: Cap injected memory at ~2000 tokens. Use recency + relevance scoring to pick the most useful memories. Older episodic memories get progressively summarized (daily → weekly → monthly summaries)
7. **REST endpoints**:
   - `GET /agents/{id}/memory` — full memory dump for an agent
   - `GET /agents/{id}/memory/episodic` — run history
   - `GET /agents/{id}/memory/semantic?query=...` — search factual knowledge
   - `DELETE /agents/{id}/memory` — wipe an agent's memory (fresh start)
   - `POST /agents/{id}/memory/teach` — manually inject a fact or strategy into an agent's memory

**Frontend**:
8. **Memory panel in AgentCard**: Expandable section showing the agent's memory stats (runs remembered, facts stored, lessons learned) with drill-down views
9. **"Teach" button**: Lets the user manually add knowledge to an agent's memory without running a task
10. **Memory indicator**: Visual badge on agent sprites showing memory depth (new agent vs experienced agent)

**Files touched**: `graph.py`, `main.py`, `planner.py`, `AgentCard.tsx`, `Sidebar.tsx`
**New files**: `backend/agent_memory/` (directory tree), `backend/memory_manager.py` (load/save/query/summarize logic)

---

## 13. Context-Aware Reasoning Engine

**Goal**: Replace the default single-pass LLM invocation with a structured reasoning engine that gives agents the ability to plan, reflect, and self-correct before producing output. Agents don't just react — they think step-by-step, evaluate their own work, and adapt their approach based on task complexity and past performance.

### Current State
- Agents use `create_react_agent` which follows the basic ReAct loop: think → act → observe → repeat
- No explicit planning phase — the agent jumps straight into tool calls
- No self-evaluation — the agent's first output is the final output (unless gated)
- No complexity-aware routing — simple and complex tasks get the same treatment
- The only "reasoning" control is model selection (Feature 7) — no structural reasoning improvements

### Reasoning Architecture

```
┌─────────────────────────────────────────────┐
│            Reasoning Engine                  │
│                                              │
│  1. CLASSIFY → assess task complexity        │
│  2. PLAN    → decompose into sub-steps       │
│  3. EXECUTE → run sub-steps (ReAct loop)     │
│  4. REFLECT → evaluate output quality        │
│  5. REVISE  → self-correct if needed         │
│  6. DELIVER → produce final output           │
└─────────────────────────────────────────────┘
```

### Implementation Plan

**Backend — Reasoning Pipeline**:
1. **Task complexity classifier**: Before an agent starts work, classify the task into complexity tiers:
   - **Simple** (Tier 1): Direct lookup, single tool call, factual answer → skip planning, go straight to ReAct
   - **Moderate** (Tier 2): Multi-step but straightforward → lightweight plan, then execute
   - **Complex** (Tier 3): Ambiguous, multi-faceted, requires synthesis → full planning + reflection loop
   Classification uses a fast LLM call (Haiku) with the task description + agent role as input. Output is a tier + reasoning

2. **Planning phase**: For Tier 2+ tasks, the agent generates an explicit step-by-step plan before acting:
   ```
   System: Before executing this task, create a plan.
   - Break the task into 2-5 concrete sub-steps
   - For each sub-step, identify which tool(s) you'll need
   - Identify potential failure points and fallback strategies
   ```
   The plan is stored in working memory (Feature 12) and emitted as an `AGENT_INTENT` event so the frontend can display it

3. **Structured execution**: Instead of a single `create_react_agent` invocation, Tier 2+ tasks execute sub-steps sequentially. Each sub-step is a mini ReAct loop with its own tool access. Between sub-steps, the engine checks:
   - Did the sub-step produce the expected output?
   - Should the plan be revised based on what was learned?
   - Is the agent stuck in a loop (same tool call repeated 3+ times)?

4. **Reflection phase**: After execution completes, Tier 3 tasks go through a self-evaluation step:
   ```
   System: Review your output against the original task.
   - Does it fully address the task requirements?
   - Are there gaps, errors, or unsupported claims?
   - Rate your confidence (1-5) and explain why.
   - If confidence < 4, identify what would improve the output.
   ```
   Reflection output is logged and, if confidence is low, triggers a revision pass

5. **Revision loop**: If reflection identifies issues, the agent re-executes specific sub-steps with the reflection feedback injected. Maximum 2 revision passes to prevent infinite loops. Each revision is emitted as an `AGENT_ACTIVITY` event

6. **Context-aware tool selection**: The reasoning engine considers the agent's past performance with each tool (from Feature 12's procedural memory) when planning:
   - If `web_search` consistently returned poor results for this type of query, suggest `web_scraper` with a specific URL instead
   - If `terminal` commands frequently failed, suggest more defensive command construction
   - This is injected into the planning prompt as "Tool performance notes"

7. **Reasoning mode per agent**: Add a `reasoning_mode` field to agents.yaml:
   ```yaml
   reviewer:
     role: QA Reviewer
     reasoning_mode: thorough    # always uses full planning + reflection
   researcher:
     role: Researcher
     reasoning_mode: adaptive    # auto-classifies complexity (default)
   formatter:
     role: Formatter
     reasoning_mode: fast        # always skips planning, straight to ReAct
   ```

**Frontend — Reasoning Visibility**:
8. **Plan display**: When an agent emits a plan, show it in the EventFeed as a numbered checklist. As sub-steps complete, check them off in real-time
9. **Reflection display**: Show the agent's self-evaluation in a collapsible section of the task summary. Confidence score shown as a badge (green/yellow/red)
10. **Revision indicator**: If an agent enters a revision loop, show a visual indicator (e.g., agent sprite walks back to Workshop from Dorm, "rethinking" animation)

**Files touched**: `graph.py` (reasoning wrapper around `create_react_agent`), `main.py` (new event subtypes), `events.py`, `planner.py` (reasoning_mode in agent config), `EventFeed.tsx`, `VillageScene.ts`
**New files**: `backend/reasoning.py` (classifier, planner, reflector, revision logic)

---

## 14. Agent Skills Database — Automatic Skill Matching

**Goal**: Each agent has access to a curated database of skills (`skills.md` files) that define reusable capabilities — prompt templates, tool combinations, and domain-specific knowledge. When a task is assigned, the system automatically matches the agent to the most relevant skills from the database, augmenting the agent's system prompt with proven techniques.

### Core Concept

A **skill** is a reusable, composable unit of agent capability:

```yaml
# skills/seo_blog_writing.yaml
id: seo_blog_writing
name: SEO Blog Writing
category: content
description: Write blog posts optimized for search engines
triggers:
  - "blog post"
  - "SEO"
  - "content writing"
  - "article"
tools_required:
  - web_search
  - file_writer
prompt_template: |
  When writing blog content, follow these SEO best practices:
  - Include the target keyword in the title, first paragraph, and 2-3 subheadings
  - Write meta descriptions under 160 characters
  - Use short paragraphs (2-3 sentences) and bullet points for scannability
  - Include internal and external links
  - Aim for 1500-2500 words for pillar content
  - Structure with H2/H3 headings every 200-300 words
examples:
  - input: "Write a blog post about AI agent frameworks"
    key_points: ["Compare top 3 frameworks", "Include code examples", "SEO-optimized headings"]
compatible_roles:
  - writer
  - content_strategist
  - marketer
```

### Skills Database Structure

```
backend/skills/
  _index.yaml                  # Master index: skill IDs, categories, trigger keywords
  content/
    seo_blog_writing.yaml
    social_media_copy.yaml
    email_campaign.yaml
    technical_writing.yaml
  research/
    competitive_analysis.yaml
    market_research.yaml
    academic_review.yaml
    data_gathering.yaml
  engineering/
    code_review.yaml
    api_design.yaml
    debugging.yaml
    test_writing.yaml
  analysis/
    data_analysis.yaml
    financial_modeling.yaml
    report_generation.yaml
  communication/
    stakeholder_update.yaml
    meeting_summary.yaml
    proposal_writing.yaml
```

### Implementation Plan

**Backend — Skills Registry**:
1. **Skill schema**: Define a Pydantic model for skills:
   ```python
   class Skill(BaseModel):
       id: str
       name: str
       category: str
       description: str
       triggers: list[str]           # keywords that activate this skill
       tools_required: list[str]     # tools the agent needs to use this skill
       prompt_template: str          # injected into the agent's system prompt
       examples: list[dict] = []     # few-shot examples
       compatible_roles: list[str]   # which agent roles benefit from this skill
       version: str = "1.0"
   ```
2. **Skills loader**: `backend/skills_registry.py` that:
   - Scans `backend/skills/` directory and loads all YAML skill files
   - Builds an in-memory index by category, trigger keywords, and compatible roles
   - Provides `search_skills(query: str, role: str) -> list[Skill]` using keyword matching + optional embedding similarity
3. **Automatic skill matching**: When `make_worker_node()` creates an agent, the skills registry is queried:
   - Input: the agent's role + the task description
   - Matching logic: (a) keyword overlap between task description and skill triggers, (b) role compatibility, (c) tool overlap between agent's assigned tools and skill's required tools
   - Top 1-3 matching skills are selected and their `prompt_template` is injected into the agent's system prompt under a `## Active Skills` section
4. **Skill-tool auto-connection**: If a matched skill requires tools the agent doesn't have, the system can either:
   - **Auto-add**: Automatically grant the agent the required tools (if available in the tool registry)
   - **Warn**: Flag in the delegation plan that the agent is missing tools for an activated skill
   - Configurable via a `skill_tool_policy: auto | warn | ignore` setting
5. **Leader skill awareness**: Update `planner.py` so the leader can see available skills when planning the team. The leader's system prompt includes a skill summary:
   ```
   ## Available Skills
   - seo_blog_writing (content): SEO-optimized blog writing [tools: web_search, file_writer]
   - competitive_analysis (research): Market competitor analysis [tools: web_search, web_scraper, data_analyzer]
   - code_review (engineering): Structured code review [tools: file_reader, git_status, linter]
   ...
   ```
   The leader can explicitly assign skills to agents in the delegation plan, or let automatic matching handle it

**Backend — Custom & Learned Skills**:
6. **User-defined skills**: Users can create custom skills via `POST /skills` with a YAML body. Custom skills are stored in `backend/skills/custom/` and indexed alongside built-in skills
7. **Skill learning from runs** (ties into Features 12 & 13): After a successful run (user approved at gate, high reflection confidence), the system can extract a new skill from the agent's behavior:
   - Identify the prompt patterns, tool sequences, and strategies that worked
   - Generate a draft skill YAML using LLM summarization
   - Present to the user for approval: "Your researcher used a 3-step approach for competitive analysis. Save as a skill?"
   - Approved skills are added to `backend/skills/learned/`

**REST Endpoints**:
8. - `GET /skills` — list all available skills (filterable by category, role)
   - `GET /skills/{id}` — get a specific skill's full definition
   - `POST /skills` — create a custom skill
   - `PUT /skills/{id}` — update a skill
   - `DELETE /skills/{id}` — delete a custom/learned skill (built-in skills cannot be deleted)
   - `GET /skills/match?task=...&role=...` — preview which skills would be auto-matched for a given task + role

**Frontend**:
9. **Skills browser**: A new panel (accessible from sidebar or onboarding) showing all available skills organized by category. Each skill card shows name, description, required tools, and compatible roles
10. **Skill assignment in team planning**: During the `review` phase of `TeamPlanScreen.tsx`, show which skills were auto-matched to each agent. The user can add/remove skills before entering the village
11. **Active skills indicator**: In `AgentCard.tsx`, show badges for the skills currently active on each agent. Clicking a badge shows the skill's prompt template
12. **Skill creation wizard**: A form for creating custom skills — name, triggers, prompt template, tool requirements. Includes a "Test" button that runs a sample task with the skill applied

### Per-Agent skills.md

Each agent can also have a personal `skills.md` file that tracks their specialized capabilities:

```
backend/agent_memory/{agent_id}/skills.md
```

This file is auto-generated from:
- Skills explicitly assigned by the leader or user
- Skills auto-matched during runs
- Skills learned from successful runs (Feature 12 + 13 integration)

Format:
```markdown
# Skills — {Agent Name}

## Active Skills
- **SEO Blog Writing** (v1.0) — matched via task keywords
- **Competitive Analysis** (v1.2) — assigned by leader

## Skill History
- Used "SEO Blog Writing" in 3 runs (last: 2024-12-15) — avg confidence: 4.2/5
- Used "Data Gathering" in 1 run (last: 2024-12-10) — avg confidence: 3.8/5

## Learned Techniques
- When doing competitive analysis, always check Crunchbase before general web search
- For blog posts, generate outline first, then fill sections (learned from Run #12 feedback)
```

This file is injected into the agent's system prompt alongside the skill templates, giving the agent a sense of its own expertise and track record.

**Files touched**: `graph.py` (skill injection in `make_worker_node()`), `planner.py` (leader skill awareness), `main.py` (skill endpoints), `leader_rules.md` (skill assignment guidance), `AgentCard.tsx`, `TeamPlanScreen.tsx`, `Sidebar.tsx`
**New files**: `backend/skills/` (directory tree with YAML skill definitions), `backend/skills_registry.py` (loader, indexer, matcher), `src/components/SkillsBrowser.tsx`

---

## 15. Conversational Multi-Agent Collaboration

**Goal**: Replace the current "parallel solo work" model — where agents execute independently and only share outputs at task boundaries — with a conversational model where agents actively discuss, debate, critique, and build on each other's work in real-time. Agents meet at the Cafe to talk through problems together instead of silently producing outputs in isolated Workshop silos.

### The Problem with Parallel Solo Work

Currently, agents fan out from START, each takes a task, works alone in a ReAct loop, produces output, and fans back in. The only inter-agent communication is:
- **Dependency context**: Downstream agents see upstream outputs as static text injected into their prompt (`context_parts` in `graph.py`)
- **Synthesis**: `synthesize_node` merges outputs at the very end via a single LLM call

This is like a team where everyone works in separate rooms and only meets for a final read-out. It misses:
- An engineer asking a researcher to clarify a finding mid-task
- A reviewer challenging an assumption before the draft is finished
- Two agents realizing they're duplicating effort and splitting the work
- An agent requesting help when stuck on a sub-problem

### Current State
- `build_execution_graph()` creates isolated worker nodes connected by explicit dependency edges
- Workers only see upstream outputs via `context_parts` — no back-and-forth
- No shared "conversation space" — agents can't address each other
- `synthesize_node` does a one-shot merge at the end, not an iterative discussion
- The Cafe zone exists visually but has no functional role beyond handoff animations
- LangGraph supports message-passing between nodes but the graph is structured as a DAG, not a conversation loop

### Conversation Architecture

```
                  ┌──────────────────────────┐
                  │     Conversation Bus      │
                  │  (shared message stream)   │
                  └──┬─────┬─────┬─────┬─────┘
                     │     │     │     │
                  ┌──▼──┐ ┌▼───┐ ┌▼───┐ ┌▼───┐
                  │Agent│ │Agt │ │Agt │ │Agt │
                  │  A  │ │ B  │ │ C  │ │ D  │
                  └─────┘ └────┘ └────┘ └────┘

Modes:
1. SOLO      — current behavior, no conversation (default for simple tasks)
2. CONSULT   — agents can ask specific agents questions mid-task
3. ROUNDTABLE — all agents discuss a topic before/after work phases
4. DEBATE    — two agents argue opposing positions, a third judges
```

### Implementation Plan

#### Phase 15A — Conversation Bus (Infrastructure)

Build the message-passing backbone that enables any conversation pattern.

1. **Conversation state**: Add a shared conversation log to the graph state:
   ```python
   class ConversationMessage(TypedDict):
       id: str
       from_agent: str
       to_agent: str | None     # None = broadcast to all
       content: str
       message_type: str        # "question", "answer", "critique", "suggestion", "agreement"
       timestamp: float
       in_reply_to: str | None  # thread support

   class GraphState(TypedDict):
       task: str
       task_outputs: Annotated[list[TaskOutput], operator.add]
       conversation: Annotated[list[ConversationMessage], operator.add]  # NEW
   ```

2. **Conversation tool**: Give agents a `send_message` tool that writes to the conversation state:
   ```python
   @tool
   def send_message(to: str | None, content: str, message_type: str = "message") -> str:
       """Send a message to another agent (or broadcast to all).
       Use this to ask questions, share findings, request feedback, or coordinate work.
       - to: agent name, or None to broadcast
       - message_type: question | answer | critique | suggestion | update
       """
   ```
   The tool appends a `ConversationMessage` to state and returns a confirmation. The addressed agent sees the message on their next ReAct iteration.

3. **Message delivery**: When a worker node runs, before each ReAct step, check `state["conversation"]` for new messages addressed to this agent. Inject unread messages into the agent's context:
   ```
   ## Incoming Messages
   [From Researcher]: "I found conflicting data on market size — $2B from Statista vs $3.5B from Gartner. Which should I use for the report?"
   ```
   The agent can then respond via `send_message` or adjust their work based on the input.

4. **WebSocket events for conversation**: Emit a new `AGENT_CONVERSATION` event when agents message each other:
   ```json
   {
     "type": "AGENT_CONVERSATION",
     "from": "Researcher",
     "to": "Analyst",
     "content": "I found conflicting data on market size...",
     "messageType": "question"
   }
   ```
   This enables the frontend to show agent-to-agent chat in real time.

#### Phase 15B — Conversation Modes

Different task types benefit from different collaboration patterns. The leader selects the mode during planning.

5. **CONSULT mode** (lightweight — default for Tier 2+ tasks):
   - Agents work on their tasks independently but have access to `send_message`
   - Messages are delivered asynchronously — the sender doesn't block waiting for a reply
   - Best for: teams where agents mostly work alone but occasionally need to coordinate
   - Graph structure: same parallel fan-out as today, but conversation state is shared
   - Example flow:
     ```
     Writer starts drafting → realizes they need a stat →
       sends "What's the latest user count?" to Researcher →
       continues drafting with placeholder →
     Researcher sees message → responds with "4.2M MAU as of Q3" →
     Writer sees response → fills in the stat
     ```

6. **ROUNDTABLE mode** (structured discussion phases):
   - Before work begins, all agents enter a discussion phase at the Cafe zone
   - The discussion has a structured format:
     - **Round 1 — Understanding**: Each agent states their understanding of the task and their planned approach (1 message each)
     - **Round 2 — Coordination**: Agents identify overlaps, gaps, and dependencies. They agree on who does what and what format outputs should take (open discussion, 2-3 rounds)
     - **Round 3 — Questions**: Agents ask clarifying questions to each other (open, until no more questions)
   - After discussion, agents execute their tasks (with CONSULT mode active for mid-work questions)
   - After execution, a second roundtable reviews outputs:
     - **Round 4 — Review**: Each agent presents their output summary. Others can critique, ask for changes, or approve
     - **Round 5 — Integration**: Agents discuss how to combine outputs. Replaces the current `synthesize_node` one-shot merge
   - Graph structure: `discussion_node` (all agents in a loop) → `work_phase` (parallel fan-out) → `review_node` (all agents in a loop) → END
   - The discussion nodes use a multi-agent conversation loop: each agent gets a turn to speak, seeing all previous messages. The loop ends when all agents signal "ready to proceed" or after a max round count

7. **DEBATE mode** (adversarial reasoning):
   - Two agents take opposing positions on a question. A third agent (or the user) judges
   - Useful for: decision-making tasks, risk assessment, strategy evaluation
   - Structure:
     - **Proposition**: Agent A presents their position
     - **Opposition**: Agent B critiques and presents the counter-position
     - **Rebuttal**: Agent A responds to critiques
     - **Counter-rebuttal**: Agent B responds
     - **Judgment**: Agent C (or user via gate) evaluates both positions and makes a decision
   - Graph structure: `debate_node` with alternating agent turns, then `judge_node`
   - Example: "Should we use microservices or a monolith?" — Architect A argues microservices, Architect B argues monolith, Tech Lead judges

8. **Leader selects mode**: Update `planner.py` so the leader's delegation plan includes a `collaboration_mode` field:
   ```yaml
   collaboration_mode: roundtable    # solo | consult | roundtable | debate
   debate_config:                     # only if mode is "debate"
     proposition_agent: optimist
     opposition_agent: skeptic
     judge_agent: strategist
     topic: "Should we pursue the enterprise market?"
   ```
   Update `leader_rules.md` with guidance on when to use each mode:
   - **Solo**: Simple, independent tasks with no cross-agent dependencies
   - **Consult**: Default for most multi-agent tasks. Low overhead, agents ask for help when needed
   - **Roundtable**: Complex tasks requiring tight coordination, shared understanding, or multi-perspective review
   - **Debate**: Decision-making tasks where exploring trade-offs is valuable

#### Phase 15C — Village Visualization

Make agent conversations visible and spatial in the village.

9. **Cafe as conversation hub**: When agents are in CONSULT/ROUNDTABLE/DEBATE mode, their sprites gather at the Cafe zone. Show speech bubbles with abbreviated message content floating above sprites:
   ```
   [Researcher sprite]: "Market size: $2B or $3.5B?"
   [Analyst sprite]: "Use Gartner — more recent"
   ```
   Speech bubbles use pixel-art chat bubble sprites with truncated text (max 40 chars). Full message visible on hover.

10. **Conversation feed in sidebar**: A new "Conversation" tab in the sidebar (alongside EventFeed) showing the full agent-to-agent chat log. Messages are threaded, color-coded by agent, and tagged by type (question, critique, etc.). The user can read the full discussion to understand how agents coordinated.

11. **Walking to consult**: In CONSULT mode, when Agent A sends a message to Agent B, Agent A's sprite walks to Agent B's current location (or they both walk to the Cafe). This creates a natural visual of agents "meeting" to discuss. After the exchange, they walk back to their respective work zones.

12. **Roundtable formation**: In ROUNDTABLE mode, all agent sprites gather in a circle formation at the Cafe. During each agent's "turn" to speak, their sprite gets a subtle highlight or speech animation. Between discussion and work phases, agents walk from Cafe to Workshop and back.

13. **Debate visualization**: In DEBATE mode, the two debating agents face each other at the Cafe. The judge agent stands between them. Each argument is shown as a speech bubble alternating sides. A "score" or argument-strength indicator could show which side is "winning" based on the judge's interim assessments.

#### Phase 15D — Conversation Quality & Control

14. **Conversation budget**: Set a max message count per conversation mode to prevent agents from chatting forever:
    - CONSULT: max 3 messages per agent pair per task
    - ROUNDTABLE: max 5 rounds per phase (understanding, coordination, review)
    - DEBATE: max 4 exchanges (proposition, opposition, rebuttal, counter-rebuttal) + judgment
    Configurable in the delegation plan or via a global setting

15. **Conversation relevance filter**: Before delivering a message, check if it's substantive (not just "Thanks!" or "Got it"). Use a lightweight LLM check or keyword heuristic. Trivial messages are logged but not delivered to reduce noise

16. **User participation**: The user can join any conversation via the sidebar chat panel. User messages appear as `[You]` in the conversation stream and are injected into the addressed agent's context. This extends Feature 3 (Mid-Run Interruption) — instead of stopping an agent, the user can *talk to them* mid-task

17. **Conversation memory**: Conversation logs are persisted in the Cafe zone memory (Feature 1) and in agent episodic memory (Feature 12). Agents remember past discussions: "In our last roundtable, we agreed to always validate data sources — I'll follow that approach"

### How It Changes the Graph

The graph structure adapts based on collaboration mode:

```
SOLO (current):
  START → [Agent A] → [Agent B] → ... → synthesize → END
                                        (parallel if no deps)

CONSULT:
  START → [Agent A + send_message tool] ─┐
       → [Agent B + send_message tool] ─┤→ synthesize → END
       → [Agent C + send_message tool] ─┘
  (same fan-out, but shared conversation state enables mid-work messaging)

ROUNDTABLE:
  START → discussion_node → [Agent A] ─┐
                          → [Agent B] ─┤→ review_node → END
                          → [Agent C] ─┘
  (discussion and review are multi-turn conversation loops at the Cafe)

DEBATE:
  START → debate_node(A vs B, judged by C) → END
  (alternating turns with structured argument format)
```

### Value

1. **Better outputs**: Agents catch each other's mistakes, fill knowledge gaps, and coordinate formats before producing final output — instead of discovering conflicts at synthesis time
2. **Natural workflow**: Real teams don't work in isolation. They chat, ask questions, and review each other's drafts. This makes agent collaboration feel human
3. **Transparency**: Users can read the conversation to understand *why* agents made certain decisions, not just *what* they produced
4. **Village comes alive**: Agents walking to meet each other, gathering at the Cafe for roundtables, debating face-to-face — the village feels like a living workplace, not a set of parallel progress bars
5. **Flexible collaboration**: Simple tasks stay fast (SOLO mode). Complex tasks get the coordination they need (ROUNDTABLE). Contentious decisions get rigorous analysis (DEBATE). The leader picks the right mode for each task

**Files touched**: `graph.py` (conversation state, message delivery, new graph modes), `main.py` (new WS events, collaboration_mode in run config), `planner.py` (leader selects mode), `leader_rules.md` (mode guidance), `events.py` (AGENT_CONVERSATION event), `tools.py` (send_message tool), `VillageScene.ts` (speech bubbles, meeting animations), `AgentRegistry.ts` (conversation-aware zone targeting), `Sidebar.tsx` (conversation tab), `EventFeed.tsx`
**New files**: `backend/conversation.py` (conversation bus, mode runners, message delivery), `src/components/ConversationFeed.tsx`, speech bubble sprite assets

---

## 16. Tile-Based Pathfinding & Interaction Animations

**Goal**: Replace the current straight-line movement with proper A* pathfinding that navigates around buildings, walls, and furniture. When agents arrive at a destination, they play context-specific interaction animations — sitting at a laptop to code, pulling a book off a shelf to research, leaning over a workbench to draft. The village stops feeling like sprites sliding over a painting and starts feeling like characters *inhabiting* a space.

### Current State — What We're Replacing

**Movement** (`movement.ts`):
- Agents move in **straight lines** from (x,y) to (targetX,targetY) at 360px/s
- No pathfinding whatsoever — agents walk through walls, furniture, and other buildings
- Arrival threshold is 4px, then velocity is set to 0
- Direction is computed from raw dx/dy for animation selection (walk-up/down/left/right)

**Animations** (`AgentRegistry.ts`):
- Only **4 walk cycles** exist (up, down, left, right — 3 frames each at 6fps)
- Idle state is a single static frame (frame 1) with a ±2px sine bob
- No sitting, no object interaction, no gestures, no working poses
- Activity is shown via floating emoji only (🔨 tool_call, 🧠 llm_generating, etc.)

**Tilemap** (`VillageScene.ts`):
- `the_ville_jan7.json` has a **Collisions** layer with `collide: true` tiles and a **Wall** layer
- These layers are loaded and `setCollisionByProperty()` is called — but only for Arcade physics body blocking, not pathfinding
- The map is 140x100 tiles (32px each = 4480x3200px world)
- Multiple object/block layers exist in the Tiled file (Object Interaction Blocks, Arena Blocks, etc.) but are completely unused

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Pathfinding Layer                       │
│                                                           │
│  1. WALKABILITY GRID — binary grid from collision tiles   │
│  2. A* PATHFINDER   — EasyStar.js or custom A*           │
│  3. PATH SMOOTHER   — reduce jagged grid paths           │
│  4. PATH FOLLOWER   — move sprite along waypoints        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 Interaction Layer                          │
│                                                           │
│  1. INTERACTION POINTS — furniture with pose/offset data  │
│  2. INTERACTION ANIMS  — sit, type, read, write, etc.    │
│  3. ARRIVAL BEHAVIOR   — walk to point → play animation  │
└─────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 16A — Walkability Grid & A* Pathfinding

Build the pathfinding infrastructure so agents navigate around obstacles.

1. **Extract walkability grid**: At scene creation time, after tilemap layers are loaded, build a 2D boolean grid (140x100) from the Collisions and Wall layers:
   ```typescript
   // In VillageScene.create(), after tilemap setup
   const walkGrid: number[][] = [];
   for (let y = 0; y < map.height; y++) {
     walkGrid[y] = [];
     for (let x = 0; x < map.width; x++) {
       const collisionTile = collisionLayer.getTileAt(x, y);
       const wallTile = wallLayer.getTileAt(x, y);
       // 0 = walkable, 1 = blocked
       walkGrid[y][x] = (collisionTile?.properties?.collide || wallTile) ? 1 : 0;
     }
   }
   ```
   Store the grid on the scene or in a dedicated `Pathfinder` system object.

2. **A* pathfinder with EasyStar.js**: Use the [EasyStar.js](https://github.com/prettymuchbryce/easystarjs) library — a lightweight, async-capable A* implementation designed for tile grids:
   ```typescript
   import EasyStar from "easystarjs";

   const finder = new EasyStar.js();
   finder.setGrid(walkGrid);
   finder.setAcceptableTiles([0]);          // only walk on non-blocked tiles
   finder.enableDiagonals();                // allow 8-directional movement
   finder.enableCornerCutting(false);       // don't cut through diagonal walls
   finder.setIterationsPerCalculation(200); // budget per frame for async calc
   ```
   EasyStar runs asynchronously — call `finder.calculate()` each frame in `update()`, and it invokes a callback when the path is ready. This prevents frame drops on large maps.

3. **Path request API**: Create `src/phaser/systems/Pathfinder.ts`:
   ```typescript
   export class Pathfinder {
     private finder: EasyStar.js;
     private tileSize: number;

     constructor(walkGrid: number[][], tileSize: number) { ... }

     /** Request a path from world coords to world coords. Returns a Promise of waypoints. */
     findPath(fromX: number, fromY: number, toX: number, toY: number): Promise<{x: number, y: number}[]> {
       const startTile = this.worldToTile(fromX, fromY);
       const endTile = this.worldToTile(toX, toY);
       return new Promise((resolve, reject) => {
         this.finder.findPath(startTile.x, startTile.y, endTile.x, endTile.y, (path) => {
           if (path === null) {
             reject(new Error(`No path from (${fromX},${fromY}) to (${toX},${toY})`));
           } else {
             resolve(path.map(p => this.tileToWorld(p.x, p.y)));
           }
         });
       });
     }

     /** Must be called every frame to process async pathfinding. */
     update() { this.finder.calculate(); }
   }
   ```

4. **Path smoothing**: Raw A* on a tile grid produces staircase paths (zigzag along tile edges). Apply a simple line-of-sight smoothing pass:
   - Walk through the waypoint list
   - For each waypoint, check if you can draw a straight line to waypoint N+2 without crossing a blocked tile (raycast against the walkability grid)
   - If yes, remove the intermediate waypoint N+1
   - Repeat until no more waypoints can be removed
   This produces clean, natural-looking diagonal paths while still respecting obstacles.

5. **Fallback for unreachable targets**: If A* returns no path (target is inside a wall, or areas are disconnected), fall back to the current straight-line movement. Log a warning. This keeps the system robust during development — no agent gets permanently stuck.

#### Phase 16B — Path Following & Walk Animation

Replace the straight-line `updateMovement()` with waypoint-following movement.

6. **Path follower in AgentRegistry**: Each agent sprite gets a `currentPath: {x,y}[]` and `pathIndex: number`. Replace the direct (dx,dy) calculation in `updateMovement()`:
   ```typescript
   // Instead of: move directly toward (targetX, targetY)
   // Now: move toward currentPath[pathIndex], advance index on arrival

   if (!agent.currentPath || agent.pathIndex >= agent.currentPath.length) {
     // Arrived at final destination or no path — stop
     sprite.setVelocity(0, 0);
     return;
   }

   const waypoint = agent.currentPath[agent.pathIndex];
   const dx = waypoint.x - sprite.x;
   const dy = waypoint.y - sprite.y;
   const dist = Math.sqrt(dx * dx + dy * dy);

   if (dist < 4) {
     agent.pathIndex++;  // advance to next waypoint
     return;             // will target next waypoint on next frame
   }

   // Move toward current waypoint at SPEED
   const vx = (dx / dist) * SPEED;
   const vy = (dy / dist) * SPEED;
   sprite.setVelocity(vx, vy);

   // Play walk animation based on dominant direction
   playWalkAnim(sprite, dx, dy);
   ```

7. **Integrate path requests into setTarget()**: When `AgentRegistry.setTarget(agentName, zone)` is called, instead of just setting `targetX/targetY`, request a path:
   ```typescript
   async setTarget(agentName: string, zone: string) {
     const agent = this.agents.get(agentName);
     const target = this.getZonePosition(zone, agentIndex);
     try {
       agent.currentPath = await this.pathfinder.findPath(
         agent.sprite.x, agent.sprite.y, target.x, target.y
       );
       agent.pathIndex = 0;
     } catch {
       // Fallback: straight-line
       agent.currentPath = [{ x: target.x, y: target.y }];
       agent.pathIndex = 0;
     }
   }
   ```

8. **Direction transitions**: With multi-waypoint paths, agents change direction at each turn. Ensure walk animations transition smoothly — when the dominant direction changes between waypoints, switch animation without a jarring snap. A simple approach: only change animation when the new direction is sustained for at least 2 frames.

9. **Debug visualization** (dev mode only): Optional path rendering — draw thin lines or dots along the agent's current path using Phaser Graphics. Toggle with a debug key. Invaluable for tuning the walkability grid and seeing where agents are routing.

#### Phase 16C — Interaction Points & Furniture Data

Define where on the map agents can interact with objects, and what interaction looks like at each point.

10. **Interaction point data**: Create `src/data/interaction_points.json` — a registry of furniture/object locations where agents can perform specific activities:
    ```json
    {
      "points": [
        {
          "id": "workshop_laptop_1",
          "zone": "WORKSHOP",
          "tileX": 78, "tileY": 48,
          "worldX": 2496, "worldY": 1536,
          "type": "laptop",
          "facing": "up",
          "animation": "sit_type",
          "activity": ["tool_call", "llm_generating"]
        },
        {
          "id": "workshop_laptop_2",
          "zone": "WORKSHOP",
          "tileX": 80, "tileY": 48,
          "worldX": 2560, "worldY": 1536,
          "type": "laptop",
          "facing": "up",
          "animation": "sit_type",
          "activity": ["tool_call", "llm_generating"]
        },
        {
          "id": "library_bookshelf_1",
          "zone": "LIBRARY",
          "tileX": 66, "tileY": 25,
          "worldX": 2112, "worldY": 800,
          "type": "bookshelf",
          "facing": "left",
          "animation": "stand_read",
          "activity": ["tool_call"]
        },
        {
          "id": "cafe_table_1",
          "zone": "CAFE",
          "tileX": 79, "tileY": 26,
          "worldX": 2528, "worldY": 832,
          "type": "table",
          "facing": "down",
          "animation": "sit_talk",
          "activity": ["idle", "planning"]
        },
        {
          "id": "house_desk_1",
          "zone": "HOUSE",
          "tileX": 109, "tileY": 34,
          "worldX": 3488, "worldY": 1088,
          "type": "desk",
          "facing": "down",
          "animation": "sit_write",
          "activity": ["gate"]
        }
      ]
    }
    ```

    Key fields:
    - **`facing`**: Which direction the sprite faces while interacting (determines which animation row to use)
    - **`animation`**: The interaction animation to play (see Phase 16D)
    - **`activity`**: Which backend activities map to this interaction point. When an agent is doing `tool_call` at the WORKSHOP, they walk to a `laptop` point. When doing `llm_generating`, also a laptop. When at the LIBRARY doing `tool_call` (web_search), they walk to a `bookshelf` point

11. **Interaction point assignment**: When an agent arrives at a zone, instead of standing at the zone's center coordinate with horizontal spacing, assign them to the nearest available (unoccupied) interaction point in that zone:
    ```typescript
    assignInteractionPoint(agentName: string, zone: string, activity: string): InteractionPoint | null {
      const points = this.interactionPoints
        .filter(p => p.zone === zone && p.activity.includes(activity) && !p.occupiedBy);

      if (points.length === 0) return null;  // fallback to zone center

      // Pick nearest available point
      const agent = this.agents.get(agentName);
      points.sort((a, b) =>
        distance(agent.sprite, a) - distance(agent.sprite, b)
      );
      points[0].occupiedBy = agentName;
      return points[0];
    }
    ```

12. **Occupancy tracking**: Each interaction point can only be used by one agent at a time. When an agent leaves a zone, release their interaction point. If all points in a zone are occupied, the extra agent stands nearby (current spacing behavior as fallback). This naturally limits how many agents can "work" at a building simultaneously — visually showing a capacity constraint.

13. **Extract points from Tiled object layers**: The tilemap already has unused object layers (Object Interaction Blocks, etc.). Long-term, interaction points could be authored directly in Tiled as objects with custom properties and exported in the JSON — rather than maintaining a separate `interaction_points.json`. This is a nice-to-have that makes level design easier.

#### Phase 16D — Interaction Animations

Add new sprite animations for agents interacting with furniture.

14. **Extended sprite sheets**: Expand each character's spritesheet from 12 frames to ~36 frames to accommodate interaction poses:
    ```
    Current (12 frames):
      Row 0: walk-down  (0,1,2)
      Row 1: walk-left  (3,4,5)
      Row 2: walk-right (6,7,8)
      Row 3: walk-up    (9,10,11)

    Extended (36 frames):
      Row 0-3: walk cycles (unchanged — 12 frames)
      Row 4:   sit-idle     (12,13,14)  — seated, facing down, slight idle sway
      Row 5:   sit-type     (15,16,17)  — seated, arms moving on keyboard
      Row 6:   sit-write    (18,19,20)  — seated, pen-on-paper hand motion
      Row 7:   sit-talk     (21,22,23)  — seated, head/hand gestures
      Row 8:   stand-read   (24,25,26)  — standing, holding book, page-turn
      Row 9:   stand-think  (27,28,29)  — standing, hand on chin, thought pose
      Row 10:  stand-point  (30,31,32)  — standing, pointing at something (for presentations/debate)
      Row 11:  celebrate    (33,34,35)  — arms up, task-complete celebration
    ```
    Each interaction animation is 3 frames at 4fps (slower than walking to feel deliberate).

15. **Animation registration**: Extend `AgentRegistry.ensureAnims()` to register the new animations:
    ```typescript
    // Interaction animations (3 frames each, 4fps, looping)
    const interactions = [
      { key: "sit-idle",    start: 12 },
      { key: "sit-type",    start: 15 },
      { key: "sit-write",   start: 18 },
      { key: "sit-talk",    start: 21 },
      { key: "stand-read",  start: 24 },
      { key: "stand-think", start: 27 },
      { key: "stand-point", start: 30 },
      { key: "celebrate",   start: 33 },
    ];
    for (const anim of interactions) {
      scene.anims.create({
        key: `${spriteKey}-${anim.key}`,
        frames: scene.anims.generateFrameNumbers(spriteKey, {
          start: anim.start, end: anim.start + 2
        }),
        frameRate: 4,
        repeat: -1,
      });
    }
    ```

16. **Arrival → interaction transition**: When an agent reaches their assigned interaction point, transition from walk animation to the point's interaction animation:
    ```typescript
    onArriveAtInteractionPoint(agent: AgentEntry, point: InteractionPoint) {
      const sprite = agent.sprite;

      // Stop movement
      sprite.setVelocity(0, 0);

      // Snap to exact interaction position (pixel-perfect alignment with furniture)
      sprite.setPosition(point.worldX, point.worldY);

      // Play the interaction animation
      sprite.play(`${agent.spriteKey}-${point.animation}`);

      // Disable idle bob while interacting (character is "locked" to furniture)
      agent.isInteracting = true;
    }
    ```

17. **Activity-to-animation mapping**: When the backend sends an `AGENT_ACTIVITY` event, the frontend now has enough context to pick the right visual:
    ```typescript
    const ACTIVITY_ANIMATION_MAP: Record<string, string> = {
      "tool_call":       "sit-type",      // using tools → typing at laptop
      "llm_generating":  "stand-think",   // LLM thinking → thinking pose
      "planning":        "sit-write",     // planning → writing notes
      "idle":            "sit-idle",      // waiting → seated idle
      "gate":            "stand-point",   // presenting to user → pointing/presenting
    };
    ```
    But this is overridden by the interaction point's own `animation` field when the agent is at a specific point. E.g., a `web_search` tool call at a Library bookshelf plays `stand-read`, not `sit-type`.

18. **Leaving interaction**: When an agent gets a new target (zone change), they:
    1. Stop the interaction animation
    2. Stand up — play 2 frames of a stand-up transition (or just snap to walk frame 1)
    3. Release the interaction point (set `occupiedBy = null`)
    4. Begin pathfinding to new destination

#### Phase 16E — Advanced Path & Interaction Polish

19. **Agent-agent collision avoidance**: Currently agents can overlap. With pathfinding in place, add lightweight steering to prevent agents from walking through each other:
    - Mark tiles occupied by stationary agents as temporarily blocked
    - Or use Phaser Arcade physics `collide()` between agent sprites (already have physics bodies) combined with a small repulsion force
    - Keep it simple — full crowd simulation is overkill for 3-8 agents

20. **Path preview on hover**: When the user hovers over an agent, show a faint dotted line of their planned path to their destination. Helps the user understand where agents are headed.

21. **Speed variation by zone**: Agents walk faster on roads/paths and slower through grass or interiors. Read a "terrain cost" from tile properties and feed it into EasyStar's `setTileCost()`:
    ```typescript
    finder.setTileCost(TILE_ROAD, 0.5);    // roads are fast
    finder.setTileCost(TILE_GRASS, 1.0);   // grass is normal
    finder.setTileCost(TILE_INTERIOR, 0.8); // indoors is slightly fast
    ```
    This makes paths prefer roads when available, creating natural-looking foot traffic patterns.

22. **Contextual idle behavior**: When agents have no active task and are at a zone, they don't just stand with an idle bob — they interact with nearby furniture:
    - At DORM: sit on bed (sit-idle)
    - At CAFE: sit at table (sit-talk, even without conversation — reading a menu)
    - At PARK: stand-think (contemplating)
    - This makes the village feel alive even between runs

23. **Task-complete celebration**: When an agent finishes their task successfully (before moving to DORM), play the `celebrate` animation for 2 seconds. A small visual reward that makes task completion feel satisfying.

### How Pathfinding Integrates with Other Features

| Feature | Integration |
|---------|-------------|
| **9A (Tool-to-Zone Routing)** | Agent pathfinds to the correct building for each tool call, then sits at the appropriate interaction point (laptop at Workshop, bookshelf at Library, terminal at Forge) |
| **15 (Conversational Collaboration)** | Agents pathfind to the Cafe to meet, sit at tables facing each other during roundtables, walk to each other's locations for consult-mode conversations |
| **8C (Worn Paths)** | Pathfinding routes accumulate into the worn-path visualization — frequently-used routes become visible trails on the tilemap |
| **4 (Zone Inspection)** | Clicking a building shows which interaction points exist and which are occupied |
| **6 (Run Replay)** | Replayed paths use the same pathfinding for accurate movement reconstruction |

### Value

1. **Immersion**: Agents walk around buildings instead of through them. They sit at desks to type, stand at bookshelves to read. The village feels like a real place, not a decorated progress dashboard
2. **Legibility**: You can tell what an agent is *doing* by watching their body, not just reading emoji. Typing at a laptop = coding. Standing at a bookshelf = researching. Sitting at a cafe table = discussing
3. **Spatial storytelling**: The paths agents take through the village tell a story. Heavy traffic between Library and Workshop means research-driven work. Agents clustering at Cafe tables means collaborative planning. These patterns emerge naturally from pathfinding + interaction points
4. **Capacity visualization**: Occupied interaction points show resource constraints at a glance. "All laptops at the Workshop are taken" means your team is at full coding capacity. Add more desks (Feature 8) to scale up
5. **Foundation for evolution**: Pathfinding is a prerequisite for worn paths (8C), agent-agent meetings (15), building capacity limits (9C), and replay accuracy (6). It's infrastructure that makes many other features possible

**Dependencies**: EasyStar.js (npm package, ~8KB), extended character spritesheets (pixel art work)
**Files touched**: `movement.ts` (replace straight-line with path-following), `AgentRegistry.ts` (interaction point assignment, new animations, arrival behavior), `VillageScene.ts` (walkability grid extraction, pathfinder init, debug rendering)
**New files**: `src/phaser/systems/Pathfinder.ts` (A* wrapper + path smoothing), `src/data/interaction_points.json` (furniture registry), extended character spritesheet PNGs (8 characters x 36 frames)

---

## 17. Confidence-Aware Gating & Agent Clarification Questions

**Goal**: Agents self-assess the uncertainty in their outputs and can proactively ask the user clarifying questions mid-task — not just at gate checkpoints. The gating policy becomes *adaptive*: high-confidence outputs sail through automatically, uncertain outputs trigger deeper review, and genuinely confused agents can pause to ask "did you mean X or Y?" before producing something wrong. The result is fewer unnecessary gates (less user fatigue) and more gates exactly when they matter (less bad output).

### The Problem with Current Gating

The gate policy (`gate_policy.py`) is a static mode switch:
- **STRICT**: gate after every task — user reviews everything, even trivially correct output
- **BALANCED**: gate on final deliverable + leader requests — misses mid-task uncertainty
- **AUTO**: gate on leader request only — agent might be deeply uncertain but never asks

The decision factors are purely structural (`is_last_task`, `leader_recommended`). The policy has **zero awareness of output quality**:
- An agent that's 99% sure its answer is correct still gets gated in STRICT mode
- An agent that's 30% sure it understood the task correctly still runs to completion in AUTO mode
- An agent that hits a genuine ambiguity ("do they want Python or JavaScript?") has no mechanism to ask — it guesses and hopes

### Current State
- `gate_policy.py` has two functions: `should_gate_task_complete()` (mode + is_last + leader_recommended) and `should_gate_tool_call()` (hardcoded for file_writer + terminal)
- Gate interrupt payload in `graph.py:248-256` has a fixed `question` string ("Agent finished. Continue?" / "Final deliverable. Approve?") — no output-quality context
- Agents have no self-assessment step — `create_react_agent` runs until it produces output, then the gate decision is made externally
- No mechanism for agents to ask the user anything mid-task — `interrupt()` only fires after the full ReAct loop completes
- The `GateModal` in the frontend shows the agent's output + a simple approve/reject interface with an optional note field

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Agent Output Pipeline                     │
│                                                              │
│  ReAct Loop ──► Self-Assessment ──► Gate Router              │
│                                                              │
│  Self-Assessment produces:                                   │
│    confidence: 0.0–1.0                                       │
│    uncertainty_reasons: ["ambiguous requirement", ...]       │
│    clarification_questions: ["Did you mean X or Y?", ...]   │
│                                                              │
│  Gate Router decides:                                        │
│    confidence > 0.85 → AUTO-APPROVE (skip gate)              │
│    confidence 0.5–0.85 → STANDARD GATE (current behavior)  │
│    confidence < 0.5 → MANDATORY GATE + flag uncertainty     │
│    has clarification_questions → CLARIFICATION GATE          │
│                        (ask user before producing output)    │
└────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 17A — Agent Self-Assessment

Add a post-task confidence evaluation step inside the worker node.

1. **Self-assessment prompt**: After `react_agent.ainvoke()` returns `final_output`, run a second LLM call (fast model — Haiku) that evaluates the output:
   ```python
   assessment_prompt = f"""Evaluate your output against the original task.

   TASK: {task_description}
   EXPECTED OUTPUT: {expected_output}
   YOUR OUTPUT: {final_output[:2000]}

   Respond with ONLY a JSON object:
   {{
     "confidence": <float 0.0-1.0>,
     "reasoning": "<1-2 sentences explaining your confidence level>",
     "uncertainty_reasons": ["<reason1>", ...],
     "clarification_questions": ["<question for the user>", ...],
     "risk_factors": ["<potential issue>", ...]
   }}

   Confidence guide:
   - 0.9-1.0: Very confident — task is clear, output fully addresses it, facts are verified
   - 0.7-0.9: Confident — output addresses the task but some details are inferred/assumed
   - 0.5-0.7: Uncertain — task was ambiguous, output may miss the user's intent, or facts are unverified
   - 0.0-0.5: Low confidence — significant ambiguity, missing context, or the output is likely incomplete/wrong
   ```

   Store the assessment result alongside the output:
   ```python
   class TaskOutput(TypedDict):
       task_key: str
       agent_name: str
       output: str
       confidence: float           # NEW
       assessment: dict            # NEW — full assessment JSON
   ```

2. **Assessment model**: Use Haiku for the assessment call — it's fast and cheap, and self-assessment doesn't need deep reasoning. The assessment adds ~0.5s and ~$0.001 per task. Configurable: `ASSESSMENT_MODEL` in env or config.

3. **Assessment caching for downstream agents**: When downstream agents receive upstream context via `context_parts`, include the confidence score so they can weight information accordingly:
   ```
   --- Output from Researcher (confidence: 0.72) ---
   {output}
   Note: The researcher flagged uncertainty about market size figures.
   ```

#### Phase 17B — Confidence-Aware Gate Policy

Replace the static mode switch with an adaptive policy that factors in confidence.

4. **Extended `should_gate_task_complete()`**: Add confidence as a gate input:
   ```python
   def should_gate_task_complete(
       mode: GatingMode,
       is_last_task: bool,
       leader_recommended: bool = False,
       confidence: float = 1.0,                   # NEW
       has_clarification_questions: bool = False,  # NEW
       risk_factors: list[str] | None = None,      # NEW
   ) -> tuple[bool, str, str]:
       """Returns: (should_gate, reason, gate_type)
       gate_type: "standard" | "clarification" | "uncertainty_review"
       """
   ```

5. **Adaptive thresholds per mode**: Each mode uses confidence differently:
   ```python
   # Confidence thresholds (configurable)
   AUTO_APPROVE_THRESHOLD = 0.85
   UNCERTAINTY_THRESHOLD = 0.50

   if mode == "STRICT":
       # Still gate everything, but annotate with confidence
       return (True, f"Review required (confidence: {confidence:.0%})", "standard")

   if mode == "BALANCED":
       if has_clarification_questions:
           return (True, "Agent needs clarification", "clarification")
       if confidence < UNCERTAINTY_THRESHOLD:
           return (True, f"Low confidence ({confidence:.0%}) — agent is uncertain", "uncertainty_review")
       if confidence >= AUTO_APPROVE_THRESHOLD and not is_last_task:
           return (False, "")  # AUTO-APPROVE — skip gate
       return (True, f"Review required (confidence: {confidence:.0%})", "standard")

   if mode == "AUTO":
       if has_clarification_questions:
           return (True, "Agent needs clarification before proceeding", "clarification")
       if confidence < UNCERTAINTY_THRESHOLD:
           return (True, f"Agent flagged uncertainty ({confidence:.0%})", "uncertainty_review")
       return (False, "")  # auto-approve everything above threshold
   ```

   The key insight: in BALANCED mode, high-confidence outputs **skip the gate entirely**, reducing user fatigue by ~60-70% on typical runs. But low-confidence outputs get *more* scrutiny than before, with explicit uncertainty flags.

6. **Gate payload includes assessment**: The `interrupt()` payload sent to the frontend now includes the full assessment:
   ```python
   decision = interrupt({
       "gate_id": gate_id,
       "run_id": run_id,
       "agent_name": agent_name,
       "question": question,
       "context": final_output,
       "reason": reason,
       "gate_source": "task_complete",
       "gate_type": gate_type,                    # NEW
       "confidence": confidence,                  # NEW
       "uncertainty_reasons": uncertainty_reasons, # NEW
       "clarification_questions": clarification_questions,  # NEW
       "risk_factors": risk_factors,               # NEW
   })
   ```

#### Phase 17C — Mid-Task Clarification Questions

Let agents ask the user questions *during* task execution, not just after.

7. **`ask_user` tool**: Give agents a tool that triggers an interrupt mid-task to ask the user a clarifying question:
   ```python
   @tool
   def ask_user(question: str, options: list[str] | None = None) -> str:
       """Ask the user a clarifying question when you're unsure how to proceed.

       Use this when:
       - The task description is ambiguous
       - You need to choose between approaches and the user's preference matters
       - You need information that isn't available via other tools

       Args:
           question: The question to ask the user
           options: Optional list of choices (if it's a multiple-choice question)

       Returns:
           The user's answer
       """
   ```

   The tool implementation triggers a LangGraph `interrupt()` with a `"clarification"` gate type. The WebSocket handler sends a `GATE_REQUESTED` event with `gate_type: "clarification"`. The frontend shows a different modal (question-focused rather than approval-focused). When the user answers, the graph resumes and the tool returns the user's response as a string.

8. **Ask-user budget**: To prevent agents from over-asking (which defeats the purpose of automation), limit clarification questions:
   - Max 2 `ask_user` calls per agent per task
   - After 2 questions, the tool returns "You've used your clarification budget. Make your best judgment and proceed."
   - Budget is configurable per mode: STRICT allows 3, BALANCED allows 2, AUTO allows 1
   - The agent's system prompt includes: "Use ask_user sparingly — only when the ambiguity would significantly change your output"

9. **Smart question routing**: When an agent uses `ask_user`, the system checks if the answer might already exist:
   - In agent memory (Feature 12): "The user prefers Python over JavaScript" → auto-answer from procedural memory
   - In previous gate feedback (Feature 1, House memory): similar question was answered before → suggest the previous answer
   - If a confident auto-answer exists, return it without interrupting the user, but log it: "Auto-answered from memory: Python"

#### Phase 17D — Frontend: Confidence-Aware Gate UI

Redesign the gate modal to surface uncertainty information.

10. **Confidence indicator in GateModal**: Show a prominent confidence gauge at the top of the gate modal:
    ```
    ┌────────────────────────────────────────────┐
    │  🟢 High Confidence (92%)                  │  ← green, minimal review needed
    │  🟡 Moderate Confidence (68%)              │  ← yellow, review recommended
    │  🔴 Low Confidence (35%)                   │  ← red, careful review needed
    └────────────────────────────────────────────┘
    ```
    Color-coded: green (>85%), yellow (50-85%), red (<50%). The gauge gives the user an immediate sense of how much scrutiny the output needs.

11. **Uncertainty callouts**: Below the confidence gauge, show the agent's `uncertainty_reasons` as highlighted callout boxes:
    ```
    ⚠️ Uncertainty Flags:
    • Task description didn't specify target audience — assumed "technical developers"
    • Market size data from 2023 — couldn't find 2024 figures
    • Unsure whether to include competitor pricing (potentially sensitive)
    ```
    These help the user focus their review on the specific areas the agent is uncertain about, rather than reading the entire output.

12. **Clarification gate variant**: When `gate_type === "clarification"`, the modal switches to a question-answer format instead of approve/reject:
    ```
    ┌────────────────────────────────────────────┐
    │  ❓ Researcher has a question              │
    │                                            │
    │  "Should the competitive analysis focus on │
    │   direct competitors only, or include      │
    │   adjacent market players?"                │
    │                                            │
    │  Suggested options:                        │
    │  ○ Direct competitors only                 │
    │  ○ Include adjacent market                 │
    │  ○ [Custom answer...]                      │
    │                                            │
    │  [Answer & Continue]                       │
    └────────────────────────────────────────────┘
    ```
    The agent provides options when possible (from the `options` param in `ask_user`), but the user can always type a custom answer.

13. **Quick-approve for high confidence**: When confidence > 85% and the mode is BALANCED, show a streamlined gate with a prominent "Auto-approved" badge and a small "Review anyway" link. The output is shown in a collapsed section. This acknowledges the gate without demanding attention:
    ```
    ┌────────────────────────────────────────────┐
    │  ✅ Auto-approved (confidence: 93%)        │
    │  Researcher completed market analysis       │
    │  [▶ Show output]  [Review anyway]           │
    └────────────────────────────────────────────┘
    ```

14. **Confidence trend in sidebar**: Show a per-agent confidence history in `AgentCard.tsx` or the sidebar — a sparkline or list of confidence scores across tasks. This helps the user spot agents that are consistently uncertain (maybe they need better prompting or different tools) vs. agents that are reliably confident.

#### Phase 17E — Feedback Loop: Confidence Calibration

Make confidence scores more accurate over time by learning from user decisions.

15. **Calibration data**: Track the relationship between confidence scores and user gate decisions:
    ```json
    {
      "agent": "Researcher",
      "task": "market_analysis",
      "confidence": 0.82,
      "user_action": "approve",          // approve | reject | approve_with_note
      "had_corrections": false,
      "timestamp": "2024-12-15T10:30:00Z"
    }
    ```
    Store in `backend/memory/house/{agent_id}_calibration.jsonl` (ties into Feature 1).

16. **Threshold tuning**: After 10+ gate interactions, compute calibration stats:
    - If an agent's outputs at confidence > 0.8 are rejected 30%+ of the time → the agent is overconfident → lower the auto-approve threshold for that agent
    - If an agent's outputs at confidence < 0.5 are approved 80%+ of the time → the agent is underconfident → raise the threshold
    - Adjust thresholds per agent, stored in agent memory (Feature 12)

17. **Assessment prompt refinement**: Feed calibration data back into the assessment prompt:
    ```
    Calibration note: In your past assessments, you've been slightly overconfident.
    Your outputs rated 0.8+ were rejected 25% of the time. Be more critical.
    ```
    This creates a self-improving loop: the agent learns to assess its own uncertainty more accurately.

18. **Confidence in events**: Emit confidence scores in WebSocket events so the frontend can use them broadly:
    ```json
    {
      "type": "TASK_SUMMARY",
      "agentName": "Researcher",
      "output": "...",
      "confidence": 0.78,
      "uncertaintyFlags": ["market size data may be outdated"]
    }
    ```
    The EventFeed, AgentCard, and any future replay system (Feature 6) can display confidence alongside outputs.

### How It Changes the Gate Flow

```
BEFORE (current):
  Agent finishes task → static mode check → gate or no gate → done

AFTER:
  Agent finishes task
    → Self-assessment (confidence + uncertainty + questions)
    → Adaptive gate router:
        ├─ confidence > 0.85 + BALANCED/AUTO → auto-approve (skip gate)
        ├─ confidence 0.5-0.85 → standard gate (with uncertainty callouts)
        ├─ confidence < 0.5 → mandatory gate + uncertainty review UI
        └─ has clarification questions → clarification gate (question modal)
    → User decision
    → Calibration data logged → thresholds adjust over time

  ALSO (mid-task):
  Agent encounters ambiguity
    → calls ask_user("Did you mean X or Y?")
    → interrupt → clarification gate → user answers → agent continues with answer
```

### Value

1. **Fewer unnecessary gates**: In BALANCED mode, high-confidence outputs auto-approve. Users stop clicking "Approve" on outputs they were going to approve anyway. Estimated 60-70% reduction in gate interactions for well-specified tasks
2. **Better-targeted gates**: When gates *do* fire, they come with uncertainty context — the user knows exactly *where* to look and *what* the agent is unsure about. Review time per gate drops
3. **Proactive clarification**: Agents ask before guessing. "Should I write this in Python or JavaScript?" takes 5 seconds to answer and saves a full task re-run. The user feels like they're collaborating with the agent, not just approving its work
4. **Calibrated trust**: Over time, confidence thresholds adapt per agent. A consistently accurate researcher gets auto-approved more. A frequently wrong writer gets reviewed more. Trust is earned, not configured
5. **Transparency**: Uncertainty flags make agent limitations visible. Users stop treating AI output as either "accept all" or "review everything" and develop nuanced, calibrated trust in each agent's capabilities

**Files touched**: `gate_policy.py` (adaptive thresholds, confidence input), `graph.py` (self-assessment step, ask_user tool, assessment in TaskOutput), `main.py` (confidence in WS events, clarification gate handling), `events.py` (confidence fields on events), `tools.py` (ask_user tool), `GateModal.tsx` (confidence UI, clarification variant, uncertainty callouts), `AgentCard.tsx` (confidence trend), `Sidebar.tsx` (auto-approve notifications), `EventFeed.tsx` (confidence badges)
**New files**: `backend/assessment.py` (self-assessment prompt + calibration logic)

---

## Updated Priority Order

| # | Feature | Complexity | Dependencies |
|---|---------|-----------|--------------|
| 10 | Skip Interview — Auto-Generate Team | Low | None |
| 1 | Zone-Based Memory System | Medium | None (new LIBRARY zone on tilemap) |
| 7 | Dynamic LLM Model Assignment + Cost Tracking | Medium | None |
| 9A | Tool-to-Zone Routing | Low | None (just routing existing tools to buildings) |
| 17A-B | Confidence-Aware Gating | Medium | None (extends existing gate_policy.py) |
| 16A-B | Pathfinding & Path Following | Medium | None (standalone Phaser-side improvement) |
| 4 | Zone Inspection (Tooltips + Memory Viewer) | Medium | Feature 1 (reads memory stores) |
| 2 | Saveable Teams | Medium | Feature 1 (memory travels with teams) |
| 9B | Expanded Tool Registry | Medium | Feature 9A (zone routing in place) |
| 17C | Mid-Task Clarification Questions | Medium | Feature 17A-B (assessment infrastructure) |
| 16C-D | Interaction Points & Animations | Medium | Feature 16A-B (pathfinding to reach points) |
| 12 | Robust Memory Persistence | Medium-High | Feature 1 (builds on zone memory infrastructure) |
| 14 | Agent Skills Database | Medium | Feature 12 (skills reference agent memory) |
| 13 | Context-Aware Reasoning Engine | High | Features 12, 14 (reasoning uses memory + skills) |
| 15A | Conversational Collaboration — Conversation Bus | Medium | None (adds conversation state to graph) |
| 15B | Conversational Collaboration — Modes | Medium-High | Feature 15A (bus infrastructure) |
| 17D-E | Confidence UI & Calibration | Medium | Features 17A-C, 12 (UI + calibration needs memory) |
| 3 | Mid-Run Interruption | Medium-High | None (but feedback goes to Feature 1's House memory) |
| 6 | Run Replay / Timeline Scrubber | Medium-High | None (but benefits from Feature 1's zone logs) |
| 11A-B | Framework-Agnostic (contract + adapter interface) | Medium-High | None (but best after core features stabilize) |
| 9C | Building as Capability Gate | Medium | Features 8A, 9B (layout + expanded tools) |
| 16E | Advanced Path & Interaction Polish | Low-Medium | Features 16C-D, 8C (interaction system + worn paths) |
| 15C-D | Conversational Collaboration — Visualization & Polish | Medium | Features 15B, 16A-B (modes + pathfinding for meetings) |
| 8 | Customizable & Evolving Village | High | Features 1, 2, 4, 9A |
| 11C-E | Framework-Agnostic (CrewAI/AutoGen/UI) | High | Feature 11A-B |
| 5 | Multi-Village & Marketplace | High | Features 1, 2, 8 |

Recommended order: **10 → 1 → 7 → 9A → 17A-B → 16A-B → 4 → 2 → 9B → 17C → 16C-D → 12 → 14 → 15A → 15B → 17D-E → 13 → 3 → 6 → 11A-B → 8 → 9C → 16E → 15C-D → 11C-E → 5**

Feature 8 is phased internally: **8A (presets)** can ship early alongside Feature 2. **8B (drag-to-customize)** and **8C (evolution)** are the longer tail. **8D (deep behavior integration)** is the final payoff that ties everything together.

Feature 9 is also phased: **9A (routing)** is a quick win that can ship very early. **9B (new tools)** is ongoing. **9C (capability gating)** requires Feature 8.

Feature 11 is phased: **11A-B (contract + adapter refactor)** is the important architectural work. **11C-E (additional adapters + UI)** are incremental after that.

Features 12, 13, 14 form a **cognitive stack**: **12 (memory)** gives agents persistence, **14 (skills)** gives them reusable capabilities, and **13 (reasoning)** gives them the intelligence to use both effectively. Best implemented in that order.

Feature 15 is phased: **15A (conversation bus)** adds the shared message-passing infrastructure. **15B (modes)** adds CONSULT/ROUNDTABLE/DEBATE patterns on top. **15C-D (visualization + polish)** brings conversations to life in the village with speech bubbles, Cafe gatherings, and quality controls. Best placed after the skills database (14) so agents have rich context to discuss, and before the reasoning engine (13) which can leverage collaborative insights.

Feature 16 is phased: **16A-B (pathfinding + path following)** is the foundation — agents navigate around obstacles instead of through them. Ship early because it's purely frontend and immediately makes the village more believable. **16C-D (interaction points + animations)** adds the "sit at laptop, read bookshelf" behavior that makes zones feel functional. **16E (polish)** adds collision avoidance, speed variation, and contextual idle — the details that make it feel alive. 16A-B is a prerequisite for 15C-D (agents need pathfinding to walk to Cafe meetings) and enhances 9A (tool-zone routing looks better when agents walk realistic paths).

Feature 17 is phased: **17A-B (self-assessment + adaptive gate policy)** is high-value and low-risk — it immediately reduces gate fatigue in BALANCED mode while catching uncertain outputs better. Ship early, right after tool-zone routing. **17C (mid-task clarification)** adds the `ask_user` tool so agents can ask questions during work, not just at the end. **17D-E (confidence UI + calibration)** is the long-term payoff — per-agent threshold tuning and rich uncertainty visualization. 17D-E benefits from Feature 12 (agent memory stores calibration data) so it's placed later in the order.
