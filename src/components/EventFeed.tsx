import { useEffect, useMemo, useRef, useState } from "react";
import { wsClient } from "../ws/client";
import type { WSEvent, TaskSummaryEvent } from "../types/events";
import type { AgentInfo } from "../types/agents";
import { SLOT_COLORS } from "../types/agents";

interface Props {
  agents: AgentInfo[];
}

/** Events worth showing in the log (skip WORLD_SNAPSHOT) */
function isVisible(ev: WSEvent): boolean {
  return ev.type !== "WORLD_SNAPSHOT";
}

export function EventFeed({ agents }: Props) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agentDotMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a, i) => {
      const displayName = a.id
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      map[displayName] = SLOT_COLORS[i % SLOT_COLORS.length].bg;
    });
    return map;
  }, [agents]);

  useEffect(() => {
    const handler = (ev: WSEvent) => {
      if (isVisible(ev)) {
        setEvents((prev) => [...prev, ev]);
      }
    };
    wsClient.on("event", handler);
    return () => {
      wsClient.off("event", handler);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 pt-2 pb-1">
        <span className="text-[8px] text-wood uppercase tracking-widest">
          Log
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-1">
        {events.length === 0 && (
          <div className="text-[8px] text-wood-light italic py-1">
            Waiting for task...
          </div>
        )}
        {events.map((ev, i) => (
          <EventEntry key={i} event={ev} agentDotMap={agentDotMap} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function clip(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function EventEntry({
  event,
  agentDotMap,
}: {
  event: WSEvent;
  agentDotMap: Record<string, string>;
}) {
  switch (event.type) {
    case "RUN_STARTED":
      return (
        <div className="pixel-inset px-2 py-1.5 text-[8px] text-accent-blue !bg-accent-blue/10 !border-accent-blue/40">
          <span className="uppercase tracking-widest">Run</span>{" "}
          <span className="text-ink">{clip(event.prompt, 100)}</span>
        </div>
      );

    case "AGENT_INTENT": {
      const dot = agentDotMap[event.agentName] || "bg-wood";
      return (
        <div className="flex items-start gap-1.5 px-1 text-[8px] text-wood">
          <span
            className={`w-1.5 h-1.5 mt-[3px] ${dot} border border-wood-dark shrink-0`}
          />
          <span>
            <span className="font-bold text-ink">{event.agentName}</span>
            {" "}
            <span className="text-wood-light">{event.message}</span>
          </span>
        </div>
      );
    }

    case "AGENT_OUTPUT": {
      const outDot = agentDotMap[event.agentName] || "bg-wood";
      return (
        <div className="flex items-start gap-1.5 px-1 text-[7px] text-wood-light">
          <span
            className={`w-1 h-1 mt-[3px] ${outDot} border border-wood-dark/50 shrink-0 rounded-full`}
          />
          <span className="break-words">{clip(event.output.replace(/\n/g, " ").trim(), 100)}</span>
        </div>
      );
    }

    case "TASK_SUMMARY":
      return <TaskSummaryEntry event={event} agentDotMap={agentDotMap} />;

    case "RUN_FINISHED":
      return (
        <div className="pixel-inset px-2 py-1.5 text-[8px] text-accent-green !bg-accent-green/10 !border-accent-green/40">
          <span className="uppercase tracking-widest">Done</span>
        </div>
      );

    case "GATE_REQUESTED": {
      const gateDot = agentDotMap[event.agentName] || "bg-wood";
      return (
        <div className="pixel-inset px-2 py-1.5 text-[8px] text-accent-amber !bg-accent-amber/10 !border-accent-amber/40">
          <span
            className={`inline-block w-1.5 h-1.5 ${gateDot} border border-wood-dark mr-1 align-middle`}
          />
          <span className="uppercase tracking-widest">Gate</span>{" "}
          <span className="text-ink">{event.agentName} awaiting approval</span>
        </div>
      );
    }

    case "ERROR":
      return (
        <div className="pixel-inset px-2 py-1 text-[8px] text-accent-coral !bg-accent-coral/10 !border-accent-coral/40">
          ! {event.message}
        </div>
      );

    default:
      return null;
  }
}

function TaskSummaryEntry({
  event,
  agentDotMap,
}: {
  event: TaskSummaryEvent;
  agentDotMap: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const dot = agentDotMap[event.agentName] || "bg-wood";

  // Show first ~3 lines as a preview
  const outputLines = event.fullOutput.trim().split("\n");
  const preview = outputLines.slice(0, 3).join("\n");
  const hasMore = outputLines.length > 3;

  return (
    <div className="bg-parchment-light/50 border border-text-dark/[0.06] rounded text-[8px]">
      {/* Header: agent name + summary */}
      <div className="flex items-start gap-1.5 px-1.5 py-1">
        <span
          className={`w-2 h-2 mt-[1px] ${dot} border border-wood-dark shrink-0 rounded-sm`}
        />
        <div className="min-w-0 flex-1">
          <span className="text-ink font-bold">{event.agentName}</span>
          <span className="text-accent-green mx-1">&#10003;</span>
          <span className="text-wood-dark text-[7px]">Finished.</span>
          <p className="text-wood-dark break-words leading-snug mt-0.5">
            {event.summary}
          </p>
        </div>
      </div>

      {/* Output preview — always visible */}
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
