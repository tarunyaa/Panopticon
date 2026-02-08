import { useEffect, useMemo, useRef, useState } from "react";
import { wsClient } from "../ws/client";
import type { WSEvent, TaskSummaryEvent } from "../types/events";
import type { AgentInfo } from "../types/agents";
import { SLOT_COLORS } from "../types/agents";

interface Props {
  agents: AgentInfo[];
}

/** Timestamp each event as it arrives */
interface TimestampedEvent {
  event: WSEvent;
  ts: number;
}

/** Get the agent name associated with an event, if any */
function eventAgent(ev: WSEvent): string | null {
  switch (ev.type) {
    case "AGENT_INTENT":
    case "AGENT_OUTPUT":
    case "TASK_SUMMARY":
    case "AGENT_ACTIVITY":
    case "GATE_REQUESTED":
      return ev.agentName;
    case "TASK_HANDOFF":
      return ev.receivingAgent;
    default:
      return null;
  }
}

/** Events worth showing in the log */
function isVisible(ev: WSEvent, prev: WSEvent | null): boolean {
  if (ev.type === "WORLD_SNAPSHOT") return false;

  // Deduplicate consecutive llm_generating events from same agent
  if (
    ev.type === "AGENT_ACTIVITY" &&
    ev.activity === "llm_generating" &&
    prev?.type === "AGENT_ACTIVITY" &&
    prev.activity === "llm_generating" &&
    prev.agentName === ev.agentName
  ) {
    return false;
  }

  // Skip idle activity events — they're just "done" markers
  if (ev.type === "AGENT_ACTIVITY" && ev.activity === "idle") return false;

  return true;
}

/** A display group is either a single event or a parallel group of AGENT_INTENTs */
type DisplayGroup =
  | { kind: "single"; event: TimestampedEvent }
  | { kind: "parallel"; events: TimestampedEvent[] };

/** Group consecutive AGENT_INTENT events into parallel blocks */
function groupEvents(events: TimestampedEvent[]): DisplayGroup[] {
  const groups: DisplayGroup[] = [];
  let i = 0;
  while (i < events.length) {
    if (events[i].event.type === "AGENT_INTENT") {
      const intents: TimestampedEvent[] = [];
      while (i < events.length && events[i].event.type === "AGENT_INTENT") {
        intents.push(events[i]);
        i++;
      }
      if (intents.length >= 2) {
        groups.push({ kind: "parallel", events: intents });
      } else {
        groups.push({ kind: "single", event: intents[0] });
      }
    } else {
      groups.push({ kind: "single", event: events[i] });
      i++;
    }
  }
  return groups;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  if (mins > 0) return `${mins}m ${s}s`;
  return `${s}s`;
}

export function EventFeed({ agents }: Props) {
  const [events, setEvents] = useState<TimestampedEvent[]>([]);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [runDone, setRunDone] = useState(false);
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

  // Collect all agent names that appear in events (for filter chips)
  const activeAgents = useMemo(() => {
    const names = new Set<string>();
    for (const { event } of events) {
      const name = eventAgent(event);
      if (name) names.add(name);
    }
    return Array.from(names);
  }, [events]);

  useEffect(() => {
    let prev: WSEvent | null = null;
    const handler = (ev: WSEvent) => {
      if (ev.type === "RUN_STARTED") {
        setRunStart(Date.now());
        setRunDone(false);
        setElapsed(0);
      }
      if (ev.type === "RUN_FINISHED") {
        setRunDone(true);
      }

      if (isVisible(ev, prev)) {
        setEvents((p) => [...p, { event: ev, ts: Date.now() }]);
      }
      prev = ev;
    };
    wsClient.on("event", handler);
    return () => {
      wsClient.off("event", handler);
    };
  }, []);

  // Live timer tick
  useEffect(() => {
    if (!runStart || runDone) return;
    const id = setInterval(() => {
      setElapsed(Date.now() - runStart);
    }, 1000);
    return () => clearInterval(id);
  }, [runStart, runDone]);

  // Capture final elapsed on finish
  useEffect(() => {
    if (runDone && runStart) {
      setElapsed(Date.now() - runStart);
    }
  }, [runDone, runStart]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Apply agent filter
  const filteredEvents = useMemo(() => {
    if (!filterAgent) return events;
    return events.filter((te) => {
      const name = eventAgent(te.event);
      // Always show lifecycle events (RUN_STARTED, RUN_FINISHED, ERROR)
      if (!name) return true;
      return name === filterAgent;
    });
  }, [events, filterAgent]);

  const displayGroups = useMemo(() => groupEvents(filteredEvents), [filteredEvents]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header row with title + timer */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <span className="text-[8px] text-wood uppercase tracking-widest">
          Log
        </span>
        {runStart && (
          <span className={`text-[8px] tabular-nums ${runDone ? "text-accent-green" : "text-wood-light"}`}>
            {runDone ? "" : "\u25cf "}
            {formatDuration(elapsed)}
          </span>
        )}
      </div>

      {/* Agent filter chips */}
      {activeAgents.length > 0 && (
        <div className="px-3 pb-1 flex flex-wrap gap-1">
          {activeAgents.map((name) => {
            const dot = agentDotMap[name] || "bg-wood";
            const active = filterAgent === name;
            return (
              <button
                key={name}
                onClick={() => setFilterAgent(active ? null : name)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[7px] rounded cursor-pointer border transition-colors ${
                  active
                    ? "border-ink bg-ink/10 text-ink font-bold"
                    : "border-wood-light/40 text-wood-light hover:border-wood hover:text-wood"
                }`}
              >
                <span className={`w-1.5 h-1.5 ${dot} border border-wood-dark shrink-0`} />
                {name}
              </button>
            );
          })}
          {filterAgent && (
            <button
              onClick={() => setFilterAgent(null)}
              className="text-[7px] text-wood-light hover:text-wood cursor-pointer px-1"
            >
              clear
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-1">
        {events.length === 0 && (
          <div className="text-[8px] text-wood-light italic py-1">
            Waiting for task...
          </div>
        )}
        {displayGroups.map((group, i) =>
          group.kind === "parallel" ? (
            <ParallelGroup
              key={i}
              events={group.events}
              agentDotMap={agentDotMap}
            />
          ) : (
            <EventEntry
              key={i}
              tse={group.event}
              agentDotMap={agentDotMap}
              runStart={runStart}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function ParallelGroup({
  events,
  agentDotMap,
}: {
  events: TimestampedEvent[];
  agentDotMap: Record<string, string>;
}) {
  return (
    <div className="border-l-2 border-accent-purple/40 pl-1.5 space-y-0.5">
      <div className="text-[7px] text-accent-purple uppercase tracking-widest">
        Parallel
      </div>
      {events.map((tse, i) => (
        <EventEntry key={i} tse={tse} agentDotMap={agentDotMap} runStart={null} />
      ))}
    </div>
  );
}

function clip(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function EventEntry({
  tse,
  agentDotMap,
  runStart,
}: {
  tse: TimestampedEvent;
  agentDotMap: Record<string, string>;
  runStart: number | null;
}) {
  const event = tse.event;
  // Relative timestamp from run start
  const relTime = runStart ? formatDuration(tse.ts - runStart) : null;

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
          <span className="flex-1">
            <span className="font-bold text-ink">{event.agentName}</span>
            {" "}
            <span className="text-wood-light">{event.message}</span>
          </span>
          {relTime && <span className="text-[6px] text-wood-light/60 tabular-nums shrink-0">{relTime}</span>}
        </div>
      );
    }

    case "AGENT_ACTIVITY": {
      const dot = agentDotMap[event.agentName] || "bg-wood";
      if (event.activity === "tool_call") {
        const tool = event.toolName || "tool";
        return (
          <div className="flex items-start gap-1.5 px-1 ml-2 text-[7px] text-wood-light">
            <span
              className={`w-1 h-1 mt-[3px] ${dot} border border-wood-dark/50 shrink-0 rounded-full`}
            />
            <span className="flex-1">
              <span className="text-accent-purple">{"\u2692"}</span>{" "}
              <span className="text-ink">{event.agentName}</span>{" "}
              <span className="text-accent-amber font-bold">{tool}</span>
            </span>
            {relTime && <span className="text-[6px] text-wood-light/60 tabular-nums shrink-0">{relTime}</span>}
          </div>
        );
      }
      if (event.activity === "llm_generating") {
        return (
          <div className="flex items-start gap-1.5 px-1 ml-2 text-[7px] text-wood-light/70">
            <span
              className={`w-1 h-1 mt-[3px] ${dot} border border-wood-dark/30 shrink-0 rounded-full`}
            />
            <span>
              <span className="text-wood-light/50">{"\u2699"}</span>{" "}
              <span className="text-ink/60">{event.agentName}</span>{" "}
              thinking...
            </span>
          </div>
        );
      }
      return null;
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

    case "TASK_HANDOFF": {
      const handoffDot = agentDotMap[event.receivingAgent] || "bg-wood";
      return (
        <div className="flex items-start gap-1.5 px-1 text-[7px] text-wood-light italic">
          <span
            className={`w-1 h-1 mt-[3px] ${handoffDot} border border-wood-dark/50 shrink-0 rounded-full`}
          />
          <span className="flex-1">
            {event.sourceAgents.join(", ")} {"\u2192"} <span className="font-bold text-ink not-italic">{event.receivingAgent}</span>
          </span>
          {relTime && <span className="text-[6px] text-wood-light/60 tabular-nums shrink-0 not-italic">{relTime}</span>}
        </div>
      );
    }

    case "TASK_SUMMARY":
      return <TaskSummaryEntry event={event} agentDotMap={agentDotMap} relTime={relTime} />;

    case "RUN_FINISHED":
      return (
        <div className="pixel-inset px-2 py-1.5 text-[8px] text-accent-green !bg-accent-green/10 !border-accent-green/40 flex items-center justify-between">
          <span className="uppercase tracking-widest">Done</span>
          {relTime && <span className="text-[7px] tabular-nums">{relTime}</span>}
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
  relTime,
}: {
  event: TaskSummaryEvent;
  agentDotMap: Record<string, string>;
  relTime: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const dot = agentDotMap[event.agentName] || "bg-wood";

  const outputLines = event.fullOutput.trim().split("\n");
  const preview = outputLines.slice(0, 3).join("\n");
  const hasMore = outputLines.length > 3;

  return (
    <div className="bg-parchment-light/50 border border-text-dark/[0.06] rounded text-[8px]">
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
