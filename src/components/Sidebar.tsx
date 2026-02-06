import { useState } from "react";
import { TaskInput } from "./TaskInput";
import { EventFeed } from "./EventFeed";
import { AgentCardFilled, AgentCardEmpty, AgentDetailPanel } from "./AgentCard";
import { useAgents } from "../hooks/useAgents";

const TOTAL_SLOTS = 6;

export function Sidebar() {
  const { agents, loading, createAgent } = useAgents();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => agents[i] ?? null);

  const toggleSlot = (i: number) =>
    setSelectedSlot((prev) => (prev === i ? null : i));

  return (
    <div className="w-[320px] h-full flex flex-col pixel-panel pixel-dither font-pixel">
      {/* Title bar */}
      <div className="px-3 py-2 flex items-center gap-2 bg-wood-dark text-parchment-light">
        <span className="text-[10px] tracking-widest uppercase">
          Panopticon
        </span>
        <span className="text-[8px] opacity-50 ml-auto">v1</span>
      </div>

      {/* Agent roster */}
      <div className="px-3 py-2">
        <div className="text-[8px] text-wood uppercase tracking-widest mb-1.5">
          Agents
        </div>
        {loading ? (
          <div className="text-[8px] text-wood-light italic py-1">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {slots.map((agent, i) =>
              agent ? (
                <AgentCardFilled
                  key={agent.id}
                  agent={agent}
                  index={i}
                  selected={selectedSlot === i}
                  onClick={() => toggleSlot(i)}
                />
              ) : (
                <AgentCardEmpty
                  key={`empty-${i}`}
                  index={i}
                  selected={selectedSlot === i}
                  onClick={() => toggleSlot(i)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Detail panel for selected slot */}
      {selectedSlot !== null && (
        <>
          <div className="pixel-sep mx-3" />
          <AgentDetailPanel
            agent={slots[selectedSlot]}
            index={selectedSlot}
            onClose={() => setSelectedSlot(null)}
            onCreate={async (payload) => {
              await createAgent(payload);
            }}
          />
        </>
      )}

      <div className="pixel-sep mx-3" />

      {/* Task input */}
      <TaskInput />

      <div className="pixel-sep mx-3" />

      {/* Activity log — fills remaining space */}
      <EventFeed agents={agents} />
    </div>
  );
}
