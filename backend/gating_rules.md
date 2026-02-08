# gating_rules.md
## Panopticon — Human-in-the-Loop Gating Policy

This document defines when the system must request **human approval** during a run.

The system supports three modes:
- **STRICT** — approve every agent output
- **BALANCED** — gate at critical points (default)
- **AUTO** — minimal interruption

A gate is a blocking checkpoint. Execution pauses until the user approves or rejects.

---

## Hard Rules (ALL Modes)

**Always gate before:**
- Creating new files
- Modifying existing files
- Deleting files
- Running terminal commands

These operations are destructive and require explicit approval regardless of mode.

---

## Mode-Specific Behavior

### STRICT Mode
Gate **after every agent task completes**.

This gives maximum control but interrupts frequently.

---

### BALANCED Mode (Default)
Gate when:
1. **Final deliverable** is ready (last task completes)
2. **File/terminal operations** (covered by hard rules above)
3. **Leader requests approval** via RequestGateTool

The Leader may request gates for:
- Important decisions or strategy choices
- Ambiguity that needs clarification
- Phase transitions (research → planning → implementation)

---

### AUTO Mode
Gate only when:
1. **File/terminal operations** (covered by hard rules above)
2. **Leader explicitly requests** via RequestGateTool

The Leader should only request gates for:
- **Validation failures** (output format errors, missing requirements)
- **High uncertainty** (agent cannot proceed without input)
- **Critical decision forks** (multiple viable paths with significant tradeoffs)

---

## Gate Request Format

When creating a gate, include:
- `reason`: Why this gate is needed (one sentence)
- `context`: Summary of what happened so far (2-5 bullets)
- `question`: What decision is needed (clear yes/no or choice)
- `options`: Optional list of choices with tradeoffs
- `recommendation`: Optional suggested action

---

## Leader Guidance

**Leader's role:** Apply these rules during execution and use RequestGateTool when appropriate.

**Backend's role:** Enforce hard rules (file/terminal gates) and respect mode settings.

Default mode: **BALANCED**
