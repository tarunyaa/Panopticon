import { useState } from "react";
import { TaskInput } from "./TaskInput";
import { EventFeed } from "./EventFeed";
import { AgentCardFilled, AgentDetailPanel } from "./AgentCard";
import { AgentFormModal } from "./onboarding/AgentFormModal";
import { useAgents } from "../hooks/useAgents";
import { AVATARS } from "../types/agents";
import type { OnboardingAgent } from "../types/onboarding";

export function Sidebar() {
  const { agents, maxAgents, loading, createAgent } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const usedSpriteKeys = agents.map(
    (_, i) => AVATARS[i % AVATARS.length].key,
  );

  const handleAgentClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleModalSave = async (agent: OnboardingAgent) => {
    await createAgent({
      agent_id: agent.name.toLowerCase().replace(/\s+/g, "_"),
      role: agent.role,
      goal: agent.goal,
      backstory: agent.backstory,
      task_description: agent.task_description,
      expected_output: agent.expected_output,
    });
    setAdding(false);
  };

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;
  const selectedIndex = selectedAgent ? agents.indexOf(selectedAgent) : -1;
  const canAdd = agents.length < maxAgents;

  return (
    <div className="w-[320px] h-full flex flex-col pixel-panel pixel-dither font-pixel">
      {/* Title bar */}
      <div className="px-3 py-2 flex items-center gap-2 bg-wood-dark text-parchment-light">
        <img src="/assets/logo.png" alt="Panopticon" className="h-10 w-10" style={{ imageRendering: "pixelated" }} />
        <span className="text-[10px] tracking-widest uppercase">
          Panopticon
        </span>
        <span className="text-[8px] opacity-50 ml-auto">v1</span>
      </div>

      {/* Agent roster */}
      <div className="px-3 py-2">
        <div className="text-[8px] text-wood uppercase tracking-widest mb-1.5">
          Agents ({agents.length}/{maxAgents})
        </div>
        {loading ? (
          <div className="text-[8px] text-wood-light italic py-1">Loading...</div>
        ) : (
          <div className="flex flex-col gap-1">
            {agents.map((agent, i) => (
              <AgentCardFilled
                key={agent.id}
                agent={agent}
                index={i}
                selected={selectedId === agent.id}
                onClick={() => handleAgentClick(agent.id)}
              />
            ))}
            {canAdd && (
              <button
                onClick={() => setAdding(true)}
                className="pixel-chip flex items-center justify-center gap-1 px-2 py-1.5 w-full cursor-pointer border-dashed !border-wood-light/60 hover:!border-wood"
              >
                <span className="text-[10px] text-wood">+</span>
                <span className="text-[8px] text-wood-light uppercase tracking-widest">Add Agent</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Detail panel for selected agent */}
      {selectedAgent && (
        <>
          <div className="pixel-sep mx-3" />
          <AgentDetailPanel
            agent={selectedAgent}
            index={selectedIndex}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}

      <div className="pixel-sep mx-3" />

      {/* Task input */}
      <TaskInput />

      <div className="pixel-sep mx-3" />

      {/* Activity log — fills remaining space */}
      <EventFeed agents={agents} />

      {/* Add agent modal */}
      {adding && (
        <AgentFormModal
          initial={null}
          usedSpriteKeys={usedSpriteKeys}
          onSave={handleModalSave}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
