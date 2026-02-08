import { useState } from "react";
import type { TaskSummaryEvent } from "../../types/events";
import { AgentAvatar } from "./AgentAvatar";

interface Props {
  event: TaskSummaryEvent;
  agentAvatarMap: Record<string, string>;
  relTime: string | null;
}

export function TaskSummaryCard({ event, agentAvatarMap, relTime }: Props) {
  const [expanded, setExpanded] = useState(false);

  const outputLines = event.fullOutput.trim().split("\n");
  const preview = outputLines.slice(0, 3).join("\n");
  const hasMore = outputLines.length > 3;

  return (
    <div className="bg-parchment-light/50 border border-text-dark/[0.06] rounded text-[8px]">
      <div className="flex items-start gap-1.5 px-1.5 py-1">
        <AgentAvatar src={agentAvatarMap[event.agentName]} size={16} />
        <div className="min-w-0 flex-1">
          <span className="text-ink font-bold">{event.agentName}</span>
          <span className="text-accent-green mx-1">&#10003;</span>
          <span className="text-wood-dark text-[7px]">Finished.</span>
          <p className="text-wood-dark break-words leading-snug mt-0.5">
            {event.summary}
          </p>
        </div>
        {relTime && <span className="text-[6px] text-wood-light/60 tabular-nums shrink-0">{relTime}</span>}
      </div>

      <div className="px-2 pb-1 border-t border-text-dark/[0.06]">
        <span className="text-[6px] text-wood uppercase tracking-widest">
          Output
        </span>
        <pre className="text-[7px] text-wood-dark whitespace-pre-wrap break-words leading-snug mt-0.5">
          {expanded ? event.fullOutput.trim() : preview}
        </pre>
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[7px] text-accent-blue hover:underline cursor-pointer mt-0.5"
          >
            {expanded ? "Show less" : `Show more (${outputLines.length} lines)`}
          </button>
        )}
      </div>
    </div>
  );
}
