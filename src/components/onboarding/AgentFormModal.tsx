import { useState } from "react";
import { AvatarPicker } from "./AvatarPicker";
import type { OnboardingAgent } from "../../types/onboarding";
import { AVATARS } from "../../types/agents";

interface AgentFormModalProps {
  initial?: OnboardingAgent | null;
  usedSpriteKeys?: string[];
  onSave: (agent: OnboardingAgent) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function AgentFormModal({
  initial,
  usedSpriteKeys,
  onSave,
  onDelete,
  onCancel,
}: AgentFormModalProps) {
  const [role, setRole] = useState(initial?.role ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [backstory, setBackstory] = useState(initial?.backstory ?? "");
  const [taskDesc, setTaskDesc] = useState(initial?.task_description ?? "");
  const [expectedOutput, setExpectedOutput] = useState(initial?.expected_output ?? "");
  const [spriteKey, setSpriteKey] = useState(initial?.spriteKey ?? "");

  const avatarName = AVATARS.find((a) => a.key === spriteKey)?.label ?? "";
  const canSave = role.trim() && goal.trim() && spriteKey;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: avatarName,
      role: role.trim(),
      goal: goal.trim(),
      backstory: backstory.trim(),
      task_description: taskDesc.trim(),
      expected_output: expectedOutput.trim(),
      spriteKey,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="pixel-panel p-6 w-[420px] max-h-[80vh] overflow-y-auto flex flex-col gap-3">
        <h3 className="font-pixel text-[10px] text-ink tracking-widest uppercase text-center">
          {initial ? "Edit Agent" : "Add Agent"}
        </h3>

        <label className="font-pixel text-[8px] text-wood uppercase">Avatar</label>
        <AvatarPicker
          selected={spriteKey || null}
          onSelect={setSpriteKey}
          excludeKeys={usedSpriteKeys?.filter((k) => k !== initial?.spriteKey)}
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Role</label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Backend Engineer"
          className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Goal</label>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What this agent aims to achieve..."
          className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Backstory</label>
        <textarea
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Agent's background..."
          rows={2}
          className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none resize-none"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Task Description</label>
        <textarea
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
          placeholder="What the agent should do..."
          rows={2}
          className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none resize-none"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Expected Output</label>
        <textarea
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          placeholder="Deliverable or output format..."
          rows={2}
          className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none resize-none"
        />

        <div className="flex gap-2 mt-2">
          <button
            className="pixel-btn font-pixel text-[10px] px-4 py-2 text-ink flex-1"
            onClick={onCancel}
          >
            Cancel
          </button>
          {onDelete && (
            <button
              className="pixel-btn font-pixel text-[10px] px-4 py-2 text-accent-coral flex-1"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          <button
            className="pixel-btn font-pixel text-[10px] px-4 py-2 text-ink flex-1"
            disabled={!canSave}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
