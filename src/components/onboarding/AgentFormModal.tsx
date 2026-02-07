import { useState, useEffect } from "react";
import { AvatarPicker } from "./AvatarPicker";
import type { OnboardingAgent, ToolInfo } from "../../types/onboarding";
import { AVATARS } from "../../types/agents";
import { API_BASE } from "../../config";

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
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>(initial?.tools ?? []);

  useEffect(() => {
    fetch(`${API_BASE}/tools`)
      .then((res) => res.json())
      .then((data) => setAvailableTools(data.tools ?? []))
      .catch(() => {});
  }, []);

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

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
      tools: selectedTools,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="pixel-panel p-6 w-[560px] max-h-[90vh] overflow-y-auto flex flex-col gap-3">
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
          className="pixel-inset px-3 py-2.5 text-sm text-ink w-full outline-none"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Goal</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What this agent aims to achieve..."
          rows={3}
          className="pixel-inset px-3 py-2.5 text-sm text-ink w-full outline-none resize-y leading-relaxed"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Backstory</label>
        <textarea
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Agent's background..."
          rows={4}
          className="pixel-inset px-3 py-2.5 text-sm text-ink w-full outline-none resize-y leading-relaxed"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Task Description</label>
        <textarea
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
          placeholder="What the agent should do..."
          rows={4}
          className="pixel-inset px-3 py-2.5 text-sm text-ink w-full outline-none resize-y leading-relaxed"
        />

        <label className="font-pixel text-[8px] text-wood uppercase">Expected Output</label>
        <textarea
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          placeholder="Deliverable or output format..."
          rows={3}
          className="pixel-inset px-3 py-2.5 text-sm text-ink w-full outline-none resize-y leading-relaxed"
        />

        {availableTools.length > 0 && (
          <>
            <label className="font-pixel text-[8px] text-wood uppercase">Tools</label>
            <div className="flex flex-wrap gap-2">
              {availableTools.map((tool) => {
                const checked = selectedTools.includes(tool.id);
                const disabled = !tool.available;
                return (
                  <label
                    key={tool.id}
                    className={`flex items-center gap-1.5 px-2 py-1 pixel-inset cursor-pointer select-none ${
                      disabled ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    title={tool.description + (disabled ? ` (needs ${tool.requires_key})` : "")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => !disabled && toggleTool(tool.id)}
                      className="accent-accent-amber w-3 h-3"
                    />
                    <span className="font-pixel text-[8px] text-ink">{tool.label}</span>
                    {disabled && (
                      <span className="font-pixel text-[7px] text-accent-coral">
                        needs key
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        )}

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
