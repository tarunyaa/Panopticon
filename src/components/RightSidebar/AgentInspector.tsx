import { useEffect, useRef } from "react";
import type { AgentInspectData } from "../../phaser/registry/AgentRegistry";
import { AgentAvatar } from "../shared/AgentAvatar";

const ACTIVITY_LABELS: Record<string, { emoji: string; label: string }> = {
  idle: { emoji: "\ud83d\udca4", label: "Idle" },
  tool_call: { emoji: "\ud83d\udd28", label: "Using tool" },
  llm_generating: { emoji: "\ud83e\udde0", label: "Thinking" },
  planning: { emoji: "\ud83d\udccb", label: "Planning" },
  done: { emoji: "\u2705", label: "Done" },
};

function formatElapsed(time: number): string {
  const secs = Math.floor((Date.now() - time) / 1000);
  if (secs < 5) return "now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

interface Props {
  data: AgentInspectData;
  avatarSrc?: string;
  onClose: () => void;
}

export function AgentInspector({ data, avatarSrc, onClose }: Props) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.log.length]);

  const act = ACTIVITY_LABELS[data.activity] || ACTIVITY_LABELS.idle;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-wood-dark text-parchment-light">
        <AgentAvatar src={avatarSrc} size={20} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold truncate">{data.name}</div>
          <div className="text-[8px] opacity-70 truncate">{data.role}</div>
        </div>
        <button
          onClick={onClose}
          className="pixel-btn px-1.5 py-0.5 text-[8px] text-ink leading-none"
        >
          X
        </button>
      </div>

      {/* Activity status */}
      <div className="px-3 py-1.5 flex items-center gap-1.5 bg-parchment-dark/50">
        <span className="text-[8px] text-wood-dark uppercase tracking-widest">Status</span>
        <span className="text-[9px] text-ink font-bold ml-auto">
          {act.emoji} {data.activity === "tool_call" && data.activityDetails
            ? data.activityDetails
            : act.label}
        </span>
      </div>

      <div className="pixel-sep" />

      {/* Log entries — scrollable */}
      <div className="overflow-y-auto max-h-[200px] px-3 py-2 space-y-1">
        {data.log.length === 0 ? (
          <div className="text-[9px] text-wood-light italic py-2 text-center">
            No activity yet
          </div>
        ) : (
          data.log.map((entry, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="text-[7px] text-wood-light shrink-0 w-[32px] text-right pt-px">
                {formatElapsed(entry.time)}
              </span>
              <span className="text-[9px] text-ink leading-snug break-words min-w-0">
                {entry.text}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
