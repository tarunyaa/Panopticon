import { useState } from "react";
import type { AgentInfo, CreateAgentPayload } from "../types/agents";
import { SLOT_COLORS, AVATARS } from "../types/agents";

// ── Filled slot — shows character avatar sprite ──

interface FilledProps {
  agent: AgentInfo;
  index: number;
  selected: boolean;
  onClick: () => void;
}

export function AgentCardFilled({ agent, index, selected, onClick }: FilledProps) {
  const color = SLOT_COLORS[index % SLOT_COLORS.length];
  const avatar = AVATARS[index % AVATARS.length];

  return (
    <button
      onClick={onClick}
      className={`pixel-chip flex items-center gap-1.5 px-1.5 py-1 w-full text-left cursor-pointer ${
        selected ? "!bg-parchment-dark !border-ink" : ""
      }`}
    >
      <div
        className="w-8 h-8 shrink-0 pixelated border border-wood-dark"
        style={{
          backgroundImage: `url(/assets/sprites/characters/${avatar.key}.png)`,
          backgroundSize: "96px 128px",
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[8px] text-ink font-bold truncate">
          {agent.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </div>
        <div className={`text-[7px] ${color.text} truncate`}>{agent.role}</div>
      </div>
    </button>
  );
}

// ── Empty slot — shows avatar preview + "Add" ──

interface EmptyProps {
  index: number;
  onClick: () => void;
  selected: boolean;
}

export function AgentCardEmpty({ index, onClick, selected }: EmptyProps) {
  const avatar = AVATARS[index % AVATARS.length];

  return (
    <button
      onClick={onClick}
      className={`pixel-chip flex items-center gap-1.5 px-1.5 py-1 w-full cursor-pointer border-dashed !border-wood-light/60 hover:!border-wood ${
        selected ? "!bg-parchment-dark !border-ink !border-solid" : ""
      }`}
    >
      <div
        className="w-8 h-8 shrink-0 pixelated border border-wood-light/40 opacity-50"
        style={{
          backgroundImage: `url(/assets/sprites/characters/${avatar.key}.png)`,
          backgroundSize: "96px 128px",
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[8px] text-wood-light font-bold">{avatar.label}</div>
        <div className="text-[7px] text-wood-light/60 uppercase tracking-widest">+ Add</div>
      </div>
    </button>
  );
}

// ── Detail panel — shown when a slot is clicked ──

interface DetailProps {
  agent: AgentInfo | null;
  index: number;
  onClose: () => void;
  onCreate: (payload: CreateAgentPayload) => Promise<void>;
}

function roleToId(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/^(\d)/, "_$1");
}

export function AgentDetailPanel({ agent, index, onClose, onCreate }: DetailProps) {
  const color = SLOT_COLORS[index % SLOT_COLORS.length];
  const avatar = AVATARS[index % AVATARS.length];
  const isNew = !agent;

  const [role, setRole] = useState(agent?.role ?? "");
  const [agentId, setAgentId] = useState(agent?.id ?? "");
  const [idTouched, setIdTouched] = useState(!!agent);
  const [goal, setGoal] = useState(agent?.goal ?? "");
  const [backstory, setBackstory] = useState(agent?.backstory ?? "");
  const [taskDesc, setTaskDesc] = useState(agent?.task_description ?? "");
  const [expectedOut, setExpectedOut] = useState(agent?.expected_output ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleRoleChange = (val: string) => {
    setRole(val);
    if (!idTouched) setAgentId(roleToId(val));
  };

  const handleSave = async () => {
    if (!role.trim() || !goal.trim() || !backstory.trim() || !taskDesc.trim() || !expectedOut.trim()) {
      setError("All fields required");
      return;
    }
    const id = agentId || roleToId(role);
    if (!id) { setError("ID required"); return; }

    setSaving(true);
    setError(null);
    try {
      await onCreate({
        agent_id: id,
        role: role.trim(),
        goal: goal.trim(),
        backstory: backstory.trim(),
        task_description: taskDesc.trim(),
        expected_output: expectedOut.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3 py-2 space-y-1">
      {/* Header with avatar */}
      <div className="flex items-center gap-2 pb-1">
        <div
          className="w-10 h-10 shrink-0 pixelated border-2 border-wood-dark"
          style={{
            backgroundImage: `url(/assets/sprites/characters/${avatar.key}.png)`,
            backgroundSize: "96px 128px",
            backgroundPosition: "0 0",
            imageRendering: "pixelated",
          }}
        />
        <div className="flex-1 min-w-0">
          <div className={`text-[9px] font-bold ${color.text}`}>
            {isNew ? "New Agent" : agent.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
          <div className="text-[7px] text-wood">Slot {index + 1}</div>
        </div>
        <button onClick={onClose} className="pixel-btn px-1.5 py-0.5 text-[8px] text-ink">X</button>
      </div>

      {/* Fields */}
      <Field label="Role" value={role} onChange={handleRoleChange} placeholder="e.g. Data Analyst" disabled={!isNew} />
      {isNew && (
        <Field label="ID" value={agentId} onChange={(v) => { setAgentId(v); setIdTouched(true); }} placeholder="auto_generated" />
      )}
      <Field label="Goal" value={goal} onChange={setGoal} placeholder="What this agent aims to do" disabled={!isNew} />
      <FieldArea label="Backstory" value={backstory} onChange={setBackstory} placeholder="Background and expertise" disabled={!isNew} />
      <FieldArea label="Task" value={taskDesc} onChange={setTaskDesc} placeholder="Task description (use {prompt} for user input)" disabled={!isNew} />
      <Field label="Expected Output" value={expectedOut} onChange={setExpectedOut} placeholder="What the task produces" disabled={!isNew} />

      {error && (
        <div className="pixel-inset px-2 py-1 text-[8px] text-accent-coral !bg-accent-coral/10">! {error}</div>
      )}

      {isNew && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="pixel-btn w-full py-1 text-[9px] text-ink font-pixel uppercase tracking-widest"
        >
          {saving ? "Creating..." : "Create Agent"}
        </button>
      )}
    </div>
  );
}

// ── Reusable field helpers ──

function Field({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <span className="text-[7px] text-wood-dark uppercase tracking-widest">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pixel-inset w-full px-2 py-1 text-[9px] text-ink font-pixel placeholder:text-wood-light focus:outline-none mt-0.5 disabled:opacity-70"
      />
    </div>
  );
}

function FieldArea({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <span className="text-[7px] text-wood-dark uppercase tracking-widest">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="pixel-inset w-full px-2 py-1 text-[9px] text-ink font-pixel placeholder:text-wood-light focus:outline-none resize-none mt-0.5 disabled:opacity-70"
      />
    </div>
  );
}
