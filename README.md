# Panopticon — Agent Village

![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg) ![Node 18+](https://img.shields.io/badge/node-18+-brightgreen) ![Vite 5](https://img.shields.io/badge/vite-5.x-646CFF)

> A browser-based village world of agent avatars where a CrewAI run drive movement and work. You can watch what each agent is doing and interrupt with feedback or approval.


## Table of Contents
- [🚀 Getting Started](#-getting-started)
- [▶️ Usage](#️-usage)
- [⚙️ Configuration](#️-configuration)
- [🧪 Testing](#-testing)
- [🤝 Contributing](#-contributing)

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10–3.13
- Node.js 18+
- npm (comes with Node.js)

### Installation
1) Install frontend dependencies:
```bash
npm install
```

2) Set up the backend environment:
```bash
cd panopticon
python -m venv .venv
.\.venv\Scripts\activate
pip install uv
crewai install
```

3) Add your API key:
```bash
# panopticon/.env
ANTHROPIC_API_KEY=your_key_here
```

---

## ▶️ Usage

### Run the frontend (React + Phaser)
```bash
npm run dev
```

### Run the CrewAI backend
```bash
cd panopticon
.\.venv\Scripts\activate
crewai run
```

---

## ⚙️ Configuration

### Crew setup
- `panopticon/src/panopticon/config/agents.yaml` defines agent roles and goals.
- `panopticon/src/panopticon/config/tasks.yaml` defines the tasks assigned to agents.
- `panopticon/src/panopticon/crew.py` wires agents, tools, and task flow.

### Assets and world plan
- Visual assets live in `generative_agents_visuals/public/assets`.
- The MVP implementation guide is in `plan.md`.

---

## 🧪 Testing

Automated tests are not configured yet. If you add tests later, a typical command would be:
```bash
cd panopticon
python -m pytest
```

---

## 🤝 Contributing

Contributions are welcome. Please:
- Keep changes small and focused.
- Document new config options in `plan.md` or this README.
- Add or update tests when you introduce new behavior.
