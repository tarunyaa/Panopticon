import { useEffect, useRef, useState } from "react";
import { wsClient } from "../../ws/client";
import type { GateResponse } from "../../ws/client";
import type { WSEvent, AgentOutputEvent, TaskHandoffEvent, GateRequestedEvent } from "../../types/events";
import { AgentAvatar } from "../shared/AgentAvatar";

type ChatEntry =
  | { kind: "output"; event: AgentOutputEvent; ts: number }
  | { kind: "handoff"; event: TaskHandoffEvent; ts: number }
  | { kind: "gate-ask"; event: GateRequestedEvent; ts: number }
  | { kind: "gate-reply"; response: GateResponse; ts: number };

interface Props {
  agentAvatarMap: Record<string, string>;
  userName?: string;
  userAvatarSrc?: string;
}

function clip(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChatLog({ agentAvatarMap, userName, userAvatarSrc }: Props) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (ev: WSEvent) => {
      if (ev.type === "RUN_STARTED") {
        setEntries([]);
        return;
      }
      if (ev.type === "AGENT_OUTPUT") {
        setEntries((p) => [...p, { kind: "output", event: ev, ts: Date.now() }]);
      }
      if (ev.type === "TASK_HANDOFF") {
        setEntries((p) => [...p, { kind: "handoff", event: ev, ts: Date.now() }]);
      }
      if (ev.type === "GATE_REQUESTED") {
        setEntries((p) => [...p, { kind: "gate-ask", event: ev, ts: Date.now() }]);
      }
    };
    wsClient.on("event", handler);

    const gateHandler = (response: GateResponse) => {
      setEntries((p) => [...p, { kind: "gate-reply", response, ts: Date.now() }]);
    };
    wsClient.on("gate-response", gateHandler);

    return () => {
      wsClient.off("event", handler);
      wsClient.off("gate-response", gateHandler);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  const displayName = userName || "You";

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2 pb-1">
        <span className="text-[8px] text-wood uppercase tracking-widest">
          Agent Chat
        </span>
      </div>
      <div className="overflow-y-auto max-h-[240px] px-3 pb-2 space-y-1.5">
        {entries.length === 0 && (
          <div className="text-[8px] text-wood-light italic py-1">
            No messages yet
          </div>
        )}
        {entries.map((entry, i) => {
          if (entry.kind === "output") {
            const ev = entry.event;
            const msg = clip(ev.output.replace(/\n/g, " ").trim());
            return (
              <div key={i} className="flex items-start gap-1.5 text-[8px]">
                <AgentAvatar src={agentAvatarMap[ev.agentName]} size={16} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-ink">{ev.agentName}</span>
                    <span className="text-[6px] text-wood-light/60 tabular-nums">{formatTime(entry.ts)}</span>
                  </div>
                  <p className="text-wood-dark leading-snug break-words mt-0.5">
                    {msg}
                  </p>
                </div>
              </div>
            );
          }

          if (entry.kind === "gate-ask") {
            const ev = entry.event;
            return (
              <div key={i} className="flex items-start gap-1.5 text-[8px]">
                <AgentAvatar src={agentAvatarMap[ev.agentName]} size={16} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-ink">{ev.agentName}</span>
                    <span className="text-[6px] text-wood-light/60 tabular-nums">{formatTime(entry.ts)}</span>
                  </div>
                  <p className="text-accent-amber leading-snug break-words mt-0.5">
                    {ev.question}
                  </p>
                </div>
              </div>
            );
          }

          if (entry.kind === "gate-reply") {
            const r = entry.response;
            const approved = r.action === "approve";
            return (
              <div key={i} className="flex items-start gap-1.5 text-[8px]">
                <AgentAvatar src={userAvatarSrc} size={16} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-ink">{displayName}</span>
                    <span className="text-[6px] text-wood-light/60 tabular-nums">{formatTime(entry.ts)}</span>
                  </div>
                  <p className={`leading-snug break-words mt-0.5 ${approved ? "text-accent-green" : "text-accent-coral"}`}>
                    {approved ? "Approved" : "Rejected"}{r.note ? `: ${clip(r.note, 100)}` : ""}
                  </p>
                </div>
              </div>
            );
          }

          // handoff — system-style message
          const ev = entry.event;
          return (
            <div key={i} className="flex items-center gap-1 text-[7px] text-wood-light px-1">
              <span className="flex-1 text-center italic">
                {ev.sourceAgents.join(", ")} {"\u2192"}{" "}
                <span className="font-bold text-ink not-italic">{ev.receivingAgent}</span>
              </span>
              <span className="text-[6px] text-wood-light/60 tabular-nums shrink-0">{formatTime(entry.ts)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
