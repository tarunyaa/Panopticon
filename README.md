# Panopticon — Agent Village

![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg) ![Node 18+](https://img.shields.io/badge/node-18+-brightgreen) ![Vite 5](https://img.shields.io/badge/vite-5.x-646CFF)

> A multi-agent orchestration platform with real-time visualization. Build a team of AI agents, give them a task, and watch them collaborate in a pixel-art village — with full human-in-the-loop control.

Panopticon uses LangGraph to run multiple Claude-powered agents in parallel, streaming their activity over WebSocket to a React + Phaser 3 frontend where each agent is a sprite moving between village zones as it works.

See [features.md](features.md) for a detailed breakdown of every feature.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) A [Serper API key](https://serper.dev/) for the `web_search` tool

### Installation

1. Install frontend dependencies:
```bash
npm install
```

2. Set up the backend:
```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

3. Create a `.env` file in the **project root**:
```
ANTHROPIC_API_KEY=your_key_here
SERPER_API_KEY=your_key_here   # optional, for web_search tool
```

---

## Usage

Start both the frontend and backend:

```bash
# Terminal 1 — Frontend (React + Phaser)
npm run dev

# Terminal 2 — Backend (FastAPI)
cd backend
.\.venv\Scripts\activate
uvicorn main:app --port 8001 --reload
```

The frontend runs at `http://localhost:5173` and connects to the backend at `http://localhost:8001`.

### Workflow

1. **Login** — Enter a crew name and describe your task
2. **Avatar** — Pick your user avatar
3. **Team Setup** — Let the leader LLM interview you and design a team, or manually configure agents from templates
4. **Village** — Watch agents work in real time, approve gates when prompted, and view results in the sidebar

---

## Project Structure

```
Panopticon/
  backend/
    main.py             # FastAPI server, WebSocket streaming, REST endpoints
    graph.py            # LangGraph StateGraph engine, worker nodes, parallel execution
    planner.py          # Team planning & task delegation via Claude
    tools.py            # Tool registry (web_search, web_scraper, terminal, file_writer)
    gate_policy.py      # Gate decision logic (Strict / Balanced / Auto)
    events.py           # Event dataclass definitions
    agents.yaml         # Agent roles, goals, backstories, tool assignments
    tasks.yaml          # Task templates with {prompt} placeholders
    delegation_plan.yaml # Generated execution plan with dependencies
    leader_rules.md     # Prompt instructions for the leader LLM
  src/
    components/
      onboarding/       # Login, avatar select, team plan/setup screens
    phaser/
      scenes/           # VillageScene — tilemap, sprite rendering, zone logic
      registry/         # AgentRegistry — sprite management, progress bars, emojis
      systems/          # Movement system — smooth interpolation between zones
    hooks/              # React hooks (useAgents, WebSocket subscription)
    ws/                 # WebSocket client singleton
    types/              # TypeScript type definitions
  public/assets/        # Tilesets, character sprites, village map
```

---

## Configuration

### Agents and Tasks
- `backend/agents.yaml` — Define agent roles, goals, backstories, and tool assignments
- `backend/tasks.yaml` — Define task templates with `{prompt}` placeholders
- `backend/delegation_plan.yaml` — Generated automatically; controls execution order and parallelism

### Gating Modes
Set in the village sidebar before submitting a task:
- **Strict** — Approve after every task
- **Balanced** — Approve final deliverable + leader-flagged tasks
- **Auto** — Approve only the final deliverable

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `SERPER_API_KEY` | No | Enables `web_search` tool |

---

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/plan-team` | POST | Leader-driven team building |
| `/run` | POST | Start task execution |
| `/agents` | GET | Fetch current team config |
| `/agents` | POST | Create a single agent |
| `/agents/setup` | PUT | Replace entire team |
| `/runs/{id}/gates/{id}` | POST | Submit gate approval/rejection |
| `/tools` | GET | List available tools |
| `/workspace/input` | GET/POST/DELETE | Manage input files |
| `/workspace/output` | GET/POST/DELETE | Manage output files |
| `/runs/{id}` | WebSocket | Stream execution events |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Phaser 3, Tailwind CSS, Vite 5, TypeScript |
| Backend | FastAPI, LangChain, LangGraph, Python 3.10+ |
| LLM | Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) |
| Communication | WebSocket (astream_events v2), REST |

---

## Contributing

Contributions are welcome. Please:
- Keep changes small and focused
- Document new config options in this README or `features.md`
- Add or update tests when you introduce new behavior
