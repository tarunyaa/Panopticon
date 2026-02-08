# Testing Guide

Run these tests in order to verify basic functionality.

## Test 1: Quick Check (30 seconds)

**Fast sanity check** - verifies delegation planning without running full crew:

```bash
cd backend
python test_quick_check.py
```

**Tests:**
- ✅ Team configuration exists
- ✅ Delegation planning works
- ✅ Parallelization configured correctly
- ✅ Task structure valid
- ✅ Plan file saved

**Expected output:**
```
✅ Team configuration
✅ Delegation planning
✅ Task structure
✅ Plan file saved

🎉 All checks passed!
```

---

## Test 2: Delegation Plan Visualization (1 minute)

**Shows the delegation strategy** - displays how tasks will be parallelized:

```bash
cd backend
python test_simple_parallel.py
```

**Shows:**
- Which agents will work in parallel
- Which agents wait for others
- Visual execution flow diagram
- Expected time savings

**Expected output:**
```
Total tasks: 3
  🟢 Parallel tasks: 2
  🟡 Sequential tasks: 1

EXECUTION FLOW:
START
  ├─ 🔀 PARALLEL (simultaneous)
  │   ├─⚡ carlos_task
  │   └─⚡ isabella_task
  ├─ ⏳ WAIT...
  └─ ▶️  klaus_task

✅ SUCCESS: 2+ agents work in PARALLEL!
```

---

## Test 3: Basic Functionality (2-5 minutes)

**Full execution test** - runs actual crew with real LLM calls:

```bash
cd backend
python test_basic_functionality.py
```

**Tests:**
1. ✅ **Agent status changes** - Agents transition from idle → working
2. ✅ **Task handoffs** - Agents pass work to each other
3. ✅ **Delegation execution** - Plan executes correctly
4. ✅ **Output generation** - Final result produced

**Expected output:**
```
🚀 RUN STARTED

👤 AGENT: Carlos
   Zone: WORKSHOP
   Message: Started working as topic researcher

👤 AGENT: Isabella
   Zone: WORKSHOP
   Message: Started working as content strategist

✅ TASK COMPLETE: Carlos
   Summary: Research findings...

✅ TASK COMPLETE: Isabella
   Summary: Content strategy...

🔄 HANDOFF TO: Klaus
   From: Carlos, Isabella
   Summary: Receiving outputs...

👤 AGENT: Klaus
   Zone: WORKSHOP
   Message: Started working as senior writer

✅ TASK COMPLETE: Klaus
   Summary: Final article...

🏁 RUN FINISHED

TEST ANALYSIS:
   ✅ Run started
   ✅ Agents activated
   ✅ Task handoffs
   ✅ Tasks completed
   ✅ Run finished

✅ ALL TESTS PASSED!
```

---

## Test 4: Full Execution with Timing (3-7 minutes)

**Performance test** - measures actual parallel speedup:

```bash
cd backend
python test_parallel_execution.py
```

**Measures:**
- Task start times
- Parallel execution timing
- Total execution time
- Time savings vs sequential

---

## Troubleshooting

### "Team not found"

Create `agents.yaml` and `tasks.yaml` in `backend/` directory.

**Quick example team:**
```yaml
# agents.yaml
leader:
  role: Leader
  goal: Coordinate the team
  backstory: Team leader
  tools: []

researcher:
  role: Researcher
  goal: Gather information
  backstory: Expert researcher
  tools: [web_search]

writer:
  role: Writer
  goal: Write content
  backstory: Skilled writer
  tools: []
```

```yaml
# tasks.yaml
researcher_task:
  description: "Research: {prompt}"
  expected_output: "Research findings"
  agent: researcher

writer_task:
  description: "Write based on research: {prompt}"
  expected_output: "Final content"
  agent: writer
```

### "Delegation planning failed"

Check:
- `ANTHROPIC_API_KEY` is set in `.env`
- API key is valid
- Network connectivity

### "No parallel tasks"

This is OK! The Leader decided sequential execution is better for this task. Try a task that clearly needs multiple parallel components:

```
"Research quantum computing technical aspects AND business applications, then write a comprehensive report"
```

### "Callbacks validation error"

Make sure you removed `ActivityTracker` from `crew.py` (should be fixed already).

---

## What Each Test Verifies

| Test | Speed | What It Checks |
|------|-------|----------------|
| `test_quick_check.py` | ⚡ 30s | Delegation planning only |
| `test_simple_parallel.py` | ⚡ 1m | Parallelization strategy |
| `test_basic_functionality.py` | 🐢 2-5m | Full execution + events |
| `test_parallel_execution.py` | 🐢 3-7m | Performance timing |

**Recommendation:** Start with Test 1, then Test 2, then Test 3 if those pass.

---

## Next Steps After Tests Pass

1. ✅ Integrate with `main.py` (already done - `run_crew()` uses delegation planning)
2. ✅ Test via API endpoints
3. ✅ Connect frontend
4. ✅ Monitor WebSocket events
5. ✅ Optimize team configurations
