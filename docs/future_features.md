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

Recommended order: **10 → 1 → 7 → 9A → 4 → 2 → 9B → 3 → 6 → 11A-B → 8 → 9C → 11C-E → 5**

Feature 8 is phased internally: **8A (presets)** can ship early alongside Feature 2. **8B (drag-to-customize)** and **8C (evolution)** are the longer tail. **8D (deep behavior integration)** is the final payoff that ties everything together.

Feature 9 is also phased: **9A (routing)** is a quick win that can ship very early. **9B (new tools)** is ongoing. **9C (capability gating)** requires Feature 8.

Feature 11 is phased: **11A-B (contract + adapter refactor)** is the important architectural work. **11C-E (additional adapters + UI)** are incremental after that.
