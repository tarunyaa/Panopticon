import { useState } from "react";
import { AgentSlotCard } from "./AgentSlotCard";
import { AgentFormModal } from "./AgentFormModal";
import { TemplatesSidebar } from "./TemplatesSidebar";
import type { OnboardingAgent } from "../../types/onboarding";
import { TEMPLATES } from "../../types/onboarding";
import { AVATARS } from "../../types/agents";

const MAX_AGENTS = 6;

interface TeamSetupScreenProps {
  leaderAvatar: { spriteKey: string; name: string };
  crewName: string;
  task: string;
  agents: OnboardingAgent[];
  onCrewName: (name: string) => void;
  onTask: (task: string) => void;
  onAgents: (agents: OnboardingAgent[]) => void;
  onEnterVillage: () => void;
  entering: boolean;
}

export function TeamSetupScreen({
  leaderAvatar,
  crewName,
  task,
  agents,
  onCrewName,
  onTask,
  onAgents,
  onEnterVillage,
  entering,
}: TeamSetupScreenProps) {
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  // Slot 0 is always the leader
  const leaderAgent: OnboardingAgent = {
    name: leaderAvatar.name,
    role: "Leader",
    goal: "Lead and coordinate the team",
    backstory: "The team leader who oversees all operations.",
    task_description: "Coordinate team members and ensure objectives are met.",
    expected_output: "Successful team coordination and project completion.",
    spriteKey: leaderAvatar.spriteKey,
  };

  // Full slots array: leader + team agents (up to 5 more)
  const slots: (OnboardingAgent | null)[] = [leaderAgent];
  for (let i = 0; i < MAX_AGENTS - 1; i++) {
    slots.push(agents[i] ?? null);
  }

  const usedSpriteKeys = slots
    .filter((s): s is OnboardingAgent => s !== null)
    .map((s) => s.spriteKey);

  const canEnter =
    crewName.trim() !== "" && task.trim() !== "" && agents.length >= 1;

  const handleApplyTemplate = (templateIndex: number) => {
    const template = TEMPLATES[templateIndex];
    // Assign sprites to template agents (skip those already used)
    const available = AVATARS.filter(
      (a) => a.key !== leaderAvatar.spriteKey,
    );
    const newAgents: OnboardingAgent[] = template.agents
      .slice(0, MAX_AGENTS - 1)
      .map((ta, i) => {
        const avatar = available[i % available.length];
        return {
          ...ta,
          name: avatar.label,
          spriteKey: avatar.key,
        };
      });
    onAgents(newAgents);
  };

  const handleSlotClick = (index: number) => {
    if (index === 0) return; // leader is locked
    setEditingSlot(index);
  };

  const handleSaveAgent = (agent: OnboardingAgent) => {
    if (editingSlot === null) return;
    const agentIndex = editingSlot - 1; // offset by leader slot
    const updated = [...agents];
    if (agentIndex < updated.length) {
      updated[agentIndex] = agent;
    } else {
      updated.push(agent);
    }
    onAgents(updated);
    setEditingSlot(null);
  };

  const handleDeleteAgent = () => {
    if (editingSlot === null) return;
    const agentIndex = editingSlot - 1;
    if (agentIndex < agents.length) {
      const updated = agents.filter((_, i) => i !== agentIndex);
      onAgents(updated);
    }
    setEditingSlot(null);
  };

  const editingAgent =
    editingSlot !== null && editingSlot > 0
      ? agents[editingSlot - 1] ?? null
      : null;

  return (
    <div className="onboarding-overlay">
      <div className="flex gap-4 max-w-4xl w-full px-4 max-h-[85vh]">
        {/* Templates sidebar */}
        <div className="w-[160px] flex-shrink-0 pixel-panel p-4">
          <TemplatesSidebar onApply={handleApplyTemplate} />
        </div>

        {/* Main area */}
        <div className="flex-1 pixel-panel p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Header with counter */}
          <div className="flex items-center justify-between">
            <h2 className="font-pixel text-[10px] text-ink tracking-widest uppercase">
              Team Setup
            </h2>
            <span className="font-pixel text-[9px] text-wood">
              {agents.length + 1} / {MAX_AGENTS}
            </span>
          </div>

          {/* Crew name */}
          <div>
            <label className="font-pixel text-[8px] text-wood uppercase tracking-widest">
              Crew Name
            </label>
            <input
              type="text"
              value={crewName}
              onChange={(e) => onCrewName(e.target.value)}
              placeholder="e.g. Alpha Squad"
              className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none mt-1"
            />
          </div>

          {/* Task */}
          <div>
            <label className="font-pixel text-[8px] text-wood uppercase tracking-widest">
              Task
            </label>
            <textarea
              value={task}
              onChange={(e) => onTask(e.target.value)}
              placeholder="Describe what your team should accomplish..."
              rows={3}
              className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none resize-none mt-1"
            />
          </div>

          {/* Agent roster grid */}
          <div>
            <label className="font-pixel text-[8px] text-wood uppercase tracking-widest mb-2 block">
              Agent Roster
            </label>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((agent, i) => (
                <AgentSlotCard
                  key={i}
                  agent={agent}
                  index={i}
                  isLeader={i === 0}
                  onClick={() => handleSlotClick(i)}
                />
              ))}
            </div>
          </div>

          {/* Enter Village button */}
          <button
            className="pixel-btn font-pixel text-[12px] px-8 py-3 text-ink tracking-wider uppercase mt-2 self-center"
            disabled={!canEnter || entering}
            onClick={onEnterVillage}
          >
            {entering ? "Entering..." : "Enter Village"}
          </button>
        </div>
      </div>

      {/* Agent form modal */}
      {editingSlot !== null && editingSlot > 0 && (
        <AgentFormModal
          initial={editingAgent}
          usedSpriteKeys={usedSpriteKeys}
          onSave={handleSaveAgent}
          onDelete={editingAgent ? handleDeleteAgent : undefined}
          onCancel={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
}
