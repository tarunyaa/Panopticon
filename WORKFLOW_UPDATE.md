# Updated Two-Phase Workflow

## ✅ Changes Implemented Based on Feedback

### Old (Incorrect) Workflow ❌
- **Phase 1**: User gives specific task → Leader creates team for that one task
- **Phase 2**: Execute that same task

### New (Correct) Workflow ✅
- **Phase 1**: User gives **team description** → Leader creates **reusable team**
- **Phase 2**: User gives **specific task** → Leader clarifies & delegates to existing team

---

## Phase 1: Team Building

### Input
- **team_description** (NOT a specific task!)
  - Examples:
    - "A software development team"
    - "A content creation team"
    - "A market research team"

### Leader Questions
Focus on **team capabilities** and **domain**, not specific tasks:
- What domain or type of work will this team handle?
- What kinds of deliverables should this team produce?
- What tools or technologies should the team be proficient in?
- What roles or specializations are needed?

### Output
- **agents.yaml**: 3-4 agents with roles, goals, backstories, tools
- **tasks.yaml**: Generic task templates with `{prompt}` placeholders

#### Example Generic Task
```yaml
research_task:
  description: "Conduct research for: {prompt}. Gather relevant data and sources."
  expected_output: "Research report with findings and sources"
  agent: researcher
```

**Key Point**: Tasks are templates that work for ANY specific task in the domain!

---

## Phase 2: Task Execution

### Input
- **prompt**: Specific task for the team to execute
  - Example: "Build a REST API for user authentication in Python"

### Leader Workflow

#### Step 1: Task Clarification (Optional)
Leader may ask 1-3 questions to clarify:
- Expected format or quality level?
- Specific constraints or dependencies?
- Ambiguous requirements?

**From delegation_rules.md:**
> Before delegating work, consider if you need more information. If clarification is needed, ask focused questions (1-3 questions max). If the task is clear, proceed directly to delegation.

#### Step 2: Delegation
Leader uses hierarchical delegation to:
- Assign work based on agent specializations
- Maximize parallelism
- Provide context between agents
- Monitor progress and quality

### Output
- Completed task through coordinated team effort

---

## API Changes

### `/plan-team` Endpoint
**Before:**
```json
{
  "task": "Create a marketing strategy",
  "history": []
}
```

**After:**
```json
{
  "team_description": "A marketing team for SaaS products",
  "history": []
}
```

### `/run` Endpoint (No Change)
```json
{
  "prompt": "Create a go-to-market strategy for our new project management tool"
}
```

---

## File Updates

### 1. `leader_rules.md` ✅
- ✅ Updated to focus on **team domain** not specific tasks
- ✅ Questions ask about capabilities, roles, tools
- ✅ Tasks are **generic templates** with `{prompt}` placeholders
- ✅ Emphasis on reusable team design

### 2. `delegation_rules.md` ✅
- ✅ Added **Phase 1: Task Clarification** (optional)
- ✅ Leader can ask 1-3 questions before delegating
- ✅ Then proceeds to **Phase 2: Delegation** responsibilities

### 3. `planner.py` ✅
- ✅ Function signature: `plan_team(team_description, history)`
- ✅ Context builder uses "team description" not "task"
- ✅ Agent goal: "design team for a specific domain"

### 4. `main.py` ✅
- ✅ API model: `team_description` instead of `task`
- ✅ Updated endpoint documentation

### 5. `MEMORY.md` ✅
- ✅ Architecture updated to reflect two-phase workflow
- ✅ Clarified single Leader agent manages both phases

---

## Example End-to-End Workflow

### Phase 1: Build a Coding Team

**User:** "I need a software development team"

**Leader asks:**
1. "What programming languages should the team specialize in?"
2. "What types of projects will this team work on?"
3. "Should the team include testing and code review roles?"

**User answers**, Leader creates:
```yaml
# agents.yaml
leader:
  role: Tech Lead
  goal: Coordinate software development projects
  ...

senior_dev:
  role: Senior Developer
  goal: Design architecture and implement core features
  ...

junior_dev:
  role: Junior Developer
  goal: Implement features and write tests
  ...

# tasks.yaml
architecture_task:
  description: "Design the architecture for: {prompt}"
  expected_output: "Architecture diagram and implementation plan"
  agent: senior_dev

implementation_task:
  description: "Implement the solution for: {prompt}"
  expected_output: "Working code with tests"
  agent: junior_dev
```

### Phase 2: Execute Specific Task

**User:** "Build a REST API for user authentication"

**Leader may ask:**
1. "Which framework should we use (Flask, FastAPI, Django)?"
2. "What database for user storage?"

**User answers**, Leader delegates:
- Senior Dev: Design authentication architecture
- Junior Dev: Implement endpoints with tests
- Leader: Coordinates, reviews, integrates

**Result:** Working REST API delivered!

---

## Key Benefits

1. **Team Reusability**: One team, many tasks
2. **Efficient Setup**: Build team once, use repeatedly
3. **Clear Separation**: Team design vs task execution
4. **Flexible Delegation**: Leader adapts to each specific task
5. **Context Preservation**: Team understands their domain

---

## Testing the Updated Workflow

### Test Phase 1
```bash
curl -X POST http://localhost:8000/plan-team \
  -H "Content-Type: application/json" \
  -d '{
    "team_description": "A content creation team",
    "history": []
  }'
```

Expected: Leader asks about content types, audience, tone, etc.

### Test Phase 2
```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a blog post about AI in healthcare"
  }'
```

Expected: Leader may clarify (length, tone, audience), then delegates to team.

---

## Summary

✅ **Phase 1**: Team description → Generic reusable team
✅ **Phase 2**: Specific task → Leader clarifies & delegates
✅ **One Leader**: Manages both planning and execution
✅ **Reusable Teams**: Build once, use for many tasks

The workflow now correctly separates team building from task execution!
