# Delegation Architecture - Parallel Task Execution

## Overview

The system now supports **Leader-driven dynamic parallelization** where the Leader agent analyzes each specific task and creates an optimal delegation plan that maximizes parallel execution.

## Three-Phase Workflow

### Phase 1: Team Building (One-Time Setup)
**File:** `planner.py` using `leader_rules.md`

**Purpose:** Create a reusable team for a domain (e.g., "content creation team")

**Leader Actions:**
1. Interviews user about team domain
2. Designs 3-4 specialized agents
3. Creates **generic task templates** (with `{prompt}` placeholder)
4. Outputs `agents.yaml` and `tasks.yaml`

**Example Output:**
```yaml
# agents.yaml
carlos:
  role: Topic Researcher
  goal: Gather comprehensive factual material
  backstory: ...
  tools: [web_search]

# tasks.yaml
carlos_task:
  description: "Research the topic: {prompt}"
  expected_output: "Research brief with facts and sources"
  agent: carlos
```

**Key Point:** No task dependencies are defined yet - these are just templates!

---

### Phase 2: Delegation Planning (Per-Task)
**File:** `planner.py` using `delegation_rules.md`
**Function:** `plan_task_delegation(prompt)`

**Purpose:** Analyze the specific user task and create an execution plan

**Leader Actions:**
1. Receives specific task (e.g., "Write a blog post about AI")
2. Reviews available task templates
3. Determines which tasks are needed
4. **Decides which tasks can run in parallel**
5. Outputs `delegation_plan.yaml`

**Example Output:**
```yaml
tasks:
  - task_key: carlos_task        # Researcher
    async_execution: true         # ⚡ Can run in parallel
    dependencies: []              # No dependencies

  - task_key: isabella_task      # Strategist
    async_execution: true         # ⚡ Can run in parallel
    dependencies: []              # No dependencies

  - task_key: klaus_task         # Writer
    async_execution: false        # ⏸ Waits for others
    dependencies: [carlos_task, isabella_task]  # Needs both
```

**Key Point:** The Leader decides parallelization strategy **per task**, not per team!

---

### Phase 3: Task Execution (Runtime)
**File:** `crew.py`

**Purpose:** Execute the delegation plan with proper parallelization

**Process:**
1. Call `plan_task_delegation()` to get the plan
2. Read `agents.yaml` and `tasks.yaml` (templates)
3. **Build Task objects based on delegation plan:**
   - Set `async_execution` from plan
   - Set `context` based on `dependencies`
4. Create Crew with hierarchical manager
5. Execute with `crew.kickoff()`

**Example Task Construction:**
```python
# Carlos task: async=true, no dependencies
carlos_task = Task(
    description="Research the topic: Write a blog post about AI",
    async_execution=True,   # ← From delegation plan
    context=None,           # ← No dependencies
    agent=carlos
)

# Isabella task: async=true, no dependencies
isabella_task = Task(
    description="Design content strategy: Write a blog post about AI",
    async_execution=True,   # ← From delegation plan
    context=None,           # ← No dependencies
    agent=isabella
)

# Klaus task: waits for both
klaus_task = Task(
    description="Write the final piece: Write a blog post about AI",
    async_execution=False,  # ← From delegation plan
    context=[carlos_task, isabella_task],  # ← Waits for both
    agent=klaus
)
```

**Execution Flow:**
```
START
  ├─ Carlos starts immediately  ⚡
  └─ Isabella starts immediately ⚡
     ↓
  [Both run in parallel]
     ↓
  Wait for both to complete
     ↓
  Klaus starts with outputs from Carlos + Isabella
     ↓
DONE
```

---

## Key Design Decisions

### Why Separate Planning from Team Building?

**Team Building** = Domain-level design (reusable)
- "I need a content creation team"
- Creates generic agent roles and task templates
- Used across many different tasks

**Delegation Planning** = Task-level strategy (per-task)
- "Write a blog post about X"
- Decides which tasks run, in what order, with what parallelism
- Different for each task

**Example:** Same content team might:
- Task A: "Quick fact-check" → Only carlos_task (no parallelism)
- Task B: "Full blog post" → carlos + isabella parallel, then klaus
- Task C: "Research report" → Only carlos_task + klaus_task

### Why Use `async_execution` + `context`?

This is CrewAI's native parallelization mechanism:
- `async_execution=true, dependencies=[]` → Runs immediately in parallel
- `context=[task1, task2]` → Waits for task1 and task2 to complete
- Final task must have `async_execution=false` to ensure crew waits

### Why Hierarchical Process?

The Leader acts as `manager_agent` during execution:
- Coordinates agent work
- Handles quality control
- Can intervene if needed
- But parallelization is handled by the delegation plan, not the manager

---

## File Structure

```
backend/
├── planner.py                    # Team building + delegation planning
│   ├── plan_team()              # Phase 1: Build team
│   └── plan_task_delegation()   # Phase 2: Plan execution
│
├── crew.py                       # Phase 3: Execute with parallelization
│   └── run_crew()               # Reads delegation plan, builds tasks
│
├── leader_rules.md              # Instructions for team building
├── delegation_rules.md          # Instructions for delegation planning
│
├── agents.yaml                  # Generic agent definitions (reusable)
├── tasks.yaml                   # Generic task templates (reusable)
└── delegation_plan.yaml         # Task-specific execution plan (per-run)
```

---

## Testing

Run the delegation planning test:
```bash
python backend/test_delegation_planning.py
```

This will:
1. Call `plan_task_delegation()` with a sample task
2. Show the delegation plan created by the Leader
3. Visualize which tasks run in parallel vs sequential

---

## Benefits

✅ **Dynamic Parallelization** - Leader decides optimal strategy per task
✅ **Maximizes Speed** - Independent tasks run simultaneously
✅ **Minimizes Cost** - Only runs needed tasks, no wasted execution
✅ **Reusable Teams** - Same team handles many different tasks
✅ **Quality Output** - Final task has context from all previous work

---

## Example Scenarios

### Scenario 1: Research-Heavy Task
**User:** "Research quantum computing trends"

**Delegation Plan:**
```yaml
tasks:
  - task_key: carlos_task
    async_execution: false
    dependencies: []
```
→ Only researcher needed, no parallelism

### Scenario 2: Full Content Creation
**User:** "Write a blog post about AI in healthcare"

**Delegation Plan:**
```yaml
tasks:
  - task_key: carlos_task      # Researcher
    async_execution: true
    dependencies: []
  - task_key: isabella_task    # Strategist
    async_execution: true
    dependencies: []
  - task_key: klaus_task       # Writer
    async_execution: false
    dependencies: [carlos_task, isabella_task]
```
→ Researcher + Strategist parallel, then Writer

### Scenario 3: Quick Strategy Only
**User:** "Give me a content outline for X"

**Delegation Plan:**
```yaml
tasks:
  - task_key: isabella_task
    async_execution: false
    dependencies: []
```
→ Only strategist needed, no parallelism
