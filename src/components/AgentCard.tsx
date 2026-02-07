import type { AgentInfo } from "../types/agents";
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

// ── Detail panel — read-only view for an existing agent ──

interface DetailProps {
  agent: AgentInfo;
  index: number;
  onClose: () => void;
}

export function AgentDetailPanel({ agent, index, onClose }: DetailProps) {
  const color = SLOT_COLORS[index % SLOT_COLORS.length];
  const avatar = AVATARS[index % AVATARS.length];

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
            {agent.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
          <div className="text-[7px] text-wood">{agent.role}</div>
        </div>
        <button onClick={onClose} className="pixel-btn px-1.5 py-0.5 text-[8px] text-ink">X</button>
      </div>

      {/* Read-only fields */}
      <DetailField label="Goal" value={agent.goal} />
      <DetailField label="Backstory" value={agent.backstory} />
      <DetailField label="Task" value={agent.task_description} />
      <DetailField label="Expected Output" value={agent.expected_output} />
    </div>
  );
}

// ── Read-only field helper ──

function DetailField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[7px] text-wood-dark uppercase tracking-widest">{label}</span>
      <div className="pixel-inset px-2 py-1 text-[9px] text-ink font-pixel mt-0.5 opacity-80">
        {value}
      </div>
    </div>
  );
}
