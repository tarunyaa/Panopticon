# Panopticon

Panopticon is a multi-agent orchestration platform with real-time visualization. Users build teams of AI agents that collaborate on complex tasks in parallel, while watching them work in a pixel-art village.

The system intelligently distributes work across agents, manages task dependencies, supports human-in-the-loop approval gates, and streams agent activity in real time over WebSocket.

**Stack:** React + Phaser 3 + Tailwind (Vite) | FastAPI + LangChain/LangGraph + Claude Sonnet 4.5

---

## Features

### Interactive Team Planning

A leader LLM interviews the user (up to 8 questions) to understand their task, then designs a team of 3–9 agents with roles, goals, backstories, and tool assignments. Three pre-built templates are available as starting points:

- **Development** — Requirements Analyst, Tech Researcher, Designer, Developer
- **Content** — Topic Researcher, Content Strategist, Senior Writer
- **Research** — Primary Researcher, Critical Analyst, Report Synthesizer

Users can also manually create and edit agents through the onboarding UI. The result is a pair of YAML files (`agents.yaml`, `tasks.yaml`) that define the team.

### Smart Delegation & Parallel Execution

When a task is submitted, the leader analyzes it and produces an execution plan (`delegation_plan.yaml`) that identifies which tasks can run concurrently and which have dependencies. The plan is compiled into a LangGraph StateGraph where:

- Independent tasks fan out from the start node and run in parallel
- Dependent tasks wait for upstream outputs and receive them as context
- A synthesize node combines multi-agent outputs via LLM when tasks converge

This means a team with two researchers feeding into one writer runs both research tasks simultaneously — not sequentially.

### Pixel-Art Village Visualization

Agents are rendered as color-tinted character sprites on a 100×100 tile village map built with multiple CuteRPG tilesets. Each agent has:

- A unique avatar (8 characters) with an accent color
- Smooth animated movement between zones
- Hover tooltips showing name and role
- A progress bar
- Activity emojis — sleeping (idle), hammer (tool call), brain (thinking)
- Speech bubbles during handoffs

Five hardcoded zones give spatial meaning to agent state:

| Zone | Location | Meaning |
|------|----------|---------|
| Park | (91, 33) | Spawn / idle |
| Workshop | cluster around (77–90, 47–51) | Active work |
| Cafe | (79, 25) | Agent-to-agent handoff |
| House | (109, 33) | Human interaction (gates) |
| Dorm | (120, 50) | Done / resting |

Agents move between zones as events arrive — starting a task sends them to the Workshop, a gate request sends them to the House, and finishing sends them to the Dorm.

### Tool System

Agents can be equipped with up to four tools:

- **web_search** — Query Serper API for real-time web results
- **web_scraper** — Fetch and parse web page content
- **terminal** — Execute shell commands (sandboxed with an allowlist: `ls`, `cat`, `grep`, `python`, `node`, `git log`, etc.; blocks `git push`, `pip install`, `npm publish`, etc.)
- **file_writer** — Create or modify files in the output directory

Tools are assigned per-agent in the YAML config and enforced at runtime.

### Human-in-the-Loop Gates

Three gating modes control how much oversight the user has during execution:

- **Strict** — Approval required after every task completion (except the final one)
- **Balanced** — Approval on the final deliverable and on any task the leader flags for review
- **Auto** — Only gates the final deliverable; fastest execution

When a gate triggers, the agent's worker node calls LangGraph's native `interrupt()`. The frontend shows a modal with the agent's output, context, and reason for the gate. The user can approve (with optional feedback notes) or reject. Approval resumes the graph via `Command(resume=...)`. Gates time out after 10 minutes.

### Real-Time Event Streaming

A WebSocket connection (`/runs/{id}`) streams structured events as agents work:

| Event | Description |
|-------|-------------|
| `RUN_STARTED` | Execution begins |
| `AGENT_INTENT` | Agent starts working on a task |
| `AGENT_ACTIVITY` | Real-time LLM generation or tool calls |
| `TASK_HANDOFF` | Outputs passed between agents |
| `TASK_SUMMARY` | Task completed with summary |
| `GATE_REQUESTED` | Human approval needed |
| `RUN_FINISHED` | All tasks complete |
| `ERROR` | System error |

Under the hood, LangGraph's `astream_events(v2)` emits raw events (chain start, model stream, tool start/end, chain end) and a `translate_event()` function maps them to the frontend contract.

### Onboarding Flow

1. **Login** — Enter a crew name and select a task
2. **Avatar Select** — Choose from 8 pixel-art character avatars
3. **Team Plan / Setup** — Either let the leader interview you and build a team, or manually configure agents using templates and an edit modal
4. **Village Entry** — Enter the live village scene

### Village Sidebar

The main view pairs the Phaser village with a sidebar containing:

- Task input box
- Gating mode selector (Strict / Balanced / Auto)
- Live event feed
- Agent cards showing status, zone, activity, and latest output
- Expandable full output view per agent
- Gate modal overlay when approval is needed

### REST API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/plan-team` | POST | Leader-driven team building |
| `/run` | POST | Start task execution (returns runId) |
| `/agents` | GET | Fetch current team config |
| `/agents` | POST | Create a single agent |
| `/agents/setup` | PUT | Replace entire team atomically |
| `/runs/{id}/gates/{id}` | POST | Submit gate approval/rejection |
| `/tools` | GET | List available tools |
| `/workspace/input` | GET/POST/DELETE | Manage input files |
| `/workspace/output` | GET/POST/DELETE | Manage output files |
| `/runs/{id}` | WebSocket | Stream execution events |

---

## Current Limitations

- Maximum 9 agents per team
- Leader agent is coordinator-only (cannot have assigned tasks)
- No persistent run history — events are lost on page refresh
- No team saving/loading across sessions
- 10-minute gate timeout before automatic approval
