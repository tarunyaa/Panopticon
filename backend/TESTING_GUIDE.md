# Testing Guide

Run these tests in order to verify functionality.

## Test Files

| File | Speed | What It Checks |
|------|-------|----------------|
| `test_tools.py` | instant | Imports, terminal security, tool registry |
| `test_planner.py` | ~1m | Team planning, delegation plan creation |
| `test_parallel.py` | ~2m | Parallelism analysis, fixed plan execution |
| `test_e2e.py` | ~3m | Full crew execution, HTTP API integration |

## Quick Start

```bash
cd backend

# 1. Verify imports and tool security (no API calls)
python test_tools.py

# 2. Test planner (requires ANTHROPIC_API_KEY)
python test_planner.py

# 3. Test parallel delegation (requires team config)
python test_parallel.py

# 4. Full end-to-end (requires ANTHROPIC_API_KEY + optional running server)
python test_e2e.py
```

## Troubleshooting

### "Team not found" / SKIPPED

Create `agents.yaml` and `tasks.yaml` in `backend/`, or run the team planning
flow first (via `test_planner.py` or the frontend onboarding).

### "Delegation planning failed"

Check:
- `ANTHROPIC_API_KEY` is set in `.env` at the project root
- API key is valid
- Network connectivity

### "No parallel tasks"

This is OK! The Leader decided sequential execution is better for the task.
Try a task that clearly needs multiple parallel components.
