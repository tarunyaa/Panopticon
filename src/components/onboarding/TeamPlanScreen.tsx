import { useState, useRef, useEffect } from "react";
import { AgentSlotCard } from "./AgentSlotCard";
import { TemplatesSidebar } from "./TemplatesSidebar";
import { AgentFormModal } from "./AgentFormModal";
import type { OnboardingAgent } from "../../types/onboarding";
import { TEMPLATES } from "../../types/onboarding";
import { AVATARS } from "../../types/agents";
import { API_BASE } from "../../config";

const MAX_AGENTS = 9;

type Phase = "input" | "chatting" | "review";

interface ChatMessage {
  role: "leader" | "user";
  content: string;
}

interface TeamPlanScreenProps {
  userAvatar: { spriteKey: string; name: string } | null;
  leaderAvatar: { spriteKey: string; name: string };
  crewName: string;
  task: string;
  agents: OnboardingAgent[];
  onCrewName: (name: string) => void;
  onTask: (task: string) => void;
  onAgents: (agents: OnboardingAgent[]) => void;
  onEnterVillage: () => void;
  entering: boolean;
  error?: string | null;
}

export function TeamPlanScreen({
  userAvatar,
  leaderAvatar,
  crewName,
  task,
  agents,
  onCrewName,
  onTask,
  onAgents,
  onEnterVillage,
  entering,
  error,
}: TeamPlanScreenProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Review phase - agent editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAgentForm, setShowAgentForm] = useState(false);

  // Get user avatar name from spriteKey
  const userAvatarName = AVATARS.find((a) => a.key === userAvatar?.spriteKey)?.label ?? "You";

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Assign avatars to raw agent data from the planner
  const assignAvatars = (
    rawAgents: Omit<OnboardingAgent, "spriteKey" | "name">[],
  ): OnboardingAgent[] => {
    const available = AVATARS.filter((a) => a.key !== leaderAvatar.spriteKey);
    return rawAgents.slice(0, MAX_AGENTS - 1).map((agent, i) => {
      const avatar = available[i % available.length];
      return {
        ...agent,
        name: avatar.label,
        spriteKey: avatar.key,
      };
    });
  };

  // Call backend /plan-team
  const callPlanner = async (history: ChatMessage[]) => {
    setThinking(true);
    setApiError(null);
    try {
      const res = await fetch(`${API_BASE}/plan-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_description: task,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();

      if (data.type === "question") {
        const leaderMsg: ChatMessage = {
          role: "leader",
          content: data.message,
        };
        setMessages((prev) => [...prev, leaderMsg]);
      } else if (data.type === "team") {
        const assigned = assignAvatars(data.agents);
        onAgents(assigned);
        setPhase("review");
      }
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Failed to reach planner",
      );
    } finally {
      setThinking(false);
    }
  };

  // "Plan My Team" button — start the conversation
  const handleStartPlanning = () => {
    if (!crewName.trim() || !task.trim()) return;
    setPhase("chatting");
    callPlanner([]);
  };

  // User sends a chat reply
  const handleSendMessage = () => {
    const text = userInput.trim();
    if (!text || thinking) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setUserInput("");
    callPlanner(updated);
  };

  // Handle Enter key in chat input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Template fallback
  const handleApplyTemplate = (templateIndex: number) => {
    const template = TEMPLATES[templateIndex];
    const assigned = assignAvatars(template.agents);
    onAgents(assigned);
    setPhase("review");
  };

  // Review phase handlers
  const handleAgentClick = (index: number) => {
    if (index === 0) return; // Can't edit leader
    setEditingIndex(index);
    setShowAgentForm(true);
  };

  const handleAddAgent = () => {
    if (agents.length >= MAX_AGENTS - 1) return; // -1 for leader
    setEditingIndex(null);
    setShowAgentForm(true);
  };

  const handleSaveAgent = (agent: OnboardingAgent) => {
    if (editingIndex === null) {
      // Adding new agent
      onAgents([...agents, agent]);
    } else {
      // Editing existing agent (index is 1-based for non-leader agents)
      const updated = [...agents];
      updated[editingIndex - 1] = agent;
      onAgents(updated);
    }
    setShowAgentForm(false);
    setEditingIndex(null);
  };

  const handleDeleteAgent = () => {
    if (editingIndex === null || editingIndex === 0) return;
    const updated = agents.filter((_, i) => i !== editingIndex - 1);
    onAgents(updated);
    setShowAgentForm(false);
    setEditingIndex(null);
  };

  // Leader agent card for slot 0 (review phase)
  const leaderAgent: OnboardingAgent = {
    name: leaderAvatar.name,
    role: "Leader",
    goal: "Lead and coordinate the team",
    backstory: "The team leader who oversees all operations.",
    task_description:
      "Coordinate team members and ensure objectives are met.",
    expected_output:
      "Successful team coordination and project completion.",
    spriteKey: leaderAvatar.spriteKey,
  };

  const slots: (OnboardingAgent | null)[] = [leaderAgent];
  for (let i = 0; i < MAX_AGENTS - 1; i++) {
    slots.push(agents[i] ?? null);
  }

  // ── INPUT PHASE ──
  if (phase === "input") {
    return (
      <div className="onboarding-overlay">
        <div className="flex gap-4 max-w-3xl w-full px-4">
          {/* Templates sidebar - always visible */}
          <div className="w-[160px] flex-shrink-0 pixel-panel p-4">
            <TemplatesSidebar onApply={handleApplyTemplate} />
          </div>

          <div className="flex-1 pixel-panel p-6 flex flex-col gap-4">
            <h2 className="font-pixel text-[10px] text-ink tracking-widest uppercase text-center">
              Plan Your Team
            </h2>

            {/* Leader avatar */}
            <div className="flex items-center justify-center gap-3">
              <div
                className="w-12 h-12 pixelated"
                style={{
                  backgroundImage: `url(assets/sprites/characters/${leaderAvatar.spriteKey}.png)`,
                  backgroundSize: "120px 160px",
                  backgroundPosition: "-40px 0px",
                }}
              />
              <span className="font-pixel text-[9px] text-wood">
                {leaderAvatar.name} will interview you
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

            {/* Team Description */}
            <div>
              <label className="font-pixel text-[8px] text-wood uppercase tracking-widest">
                What type of team do you need?
              </label>
              <textarea
                value={task}
                onChange={(e) => onTask(e.target.value)}
                placeholder="e.g., 'A software development team' or 'A content creation team'..."
                rows={4}
                className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink w-full outline-none resize-none mt-1"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-2 mt-2">
              <button
                className="pixel-btn font-pixel text-[12px] px-8 py-3 text-ink tracking-wider uppercase"
                disabled={!crewName.trim() || !task.trim()}
                onClick={handleStartPlanning}
              >
                Plan My Team
              </button>
              <span className="font-pixel text-[8px] text-wood text-center">
                Or select a template from the left
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── CHATTING PHASE ──
  if (phase === "chatting") {
    return (
      <div className="onboarding-overlay">
        <div className="pixel-panel p-6 w-full max-w-2xl max-h-[85vh] flex flex-col gap-4 mx-4">
          <h2 className="font-pixel text-[10px] text-ink tracking-widest uppercase text-center">
            {leaderAvatar.name} is planning your team
          </h2>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 min-h-[200px] max-h-[50vh] px-1">
            {messages.map((msg, i) =>
              msg.role === "leader" ? (
                <LeaderBubble
                  key={i}
                  message={msg.content}
                  spriteKey={leaderAvatar.spriteKey}
                  name={leaderAvatar.name}
                />
              ) : (
                <UserBubble
                  key={i}
                  message={msg.content}
                  spriteKey={userAvatar?.spriteKey ?? ""}
                  name={userAvatarName}
                />
              ),
            )}
            {thinking && <TypingIndicator name={leaderAvatar.name} />}
            <div ref={chatEndRef} />
          </div>

          {/* Error */}
          {apiError && (
            <span className="font-pixel text-[8px] text-red-400 text-center">
              {apiError}
            </span>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              disabled={thinking}
              className="pixel-inset px-3 py-2 font-pixel text-[10px] text-ink flex-1 outline-none"
              autoFocus
            />
            <button
              className="pixel-btn font-pixel text-[10px] px-4 py-2 text-ink"
              disabled={!userInput.trim() || thinking}
              onClick={handleSendMessage}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW PHASE ──
  return (
    <div className="onboarding-overlay">
      <div className="pixel-panel p-6 w-full max-w-4xl max-h-[85vh] flex flex-col gap-4 mx-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[10px] text-ink tracking-widest uppercase">
            Your Team
          </h2>
          <span className="font-pixel text-[9px] text-wood">
            {agents.length + 1} / {MAX_AGENTS}
          </span>
        </div>

        <p className="font-pixel text-[8px] text-wood text-center">
          Click agents to view/edit. Leader can't be edited.
        </p>

        {/* Agent roster grid */}
        <div className="grid grid-cols-3 gap-2">
          {slots.map((agent, i) => (
            <AgentSlotCard
              key={i}
              agent={agent}
              index={i}
              isLeader={i === 0}
              onClick={() => agent ? handleAgentClick(i) : i > 0 && handleAddAgent()}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <button
            className="pixel-btn font-pixel text-[12px] px-8 py-3 text-ink tracking-wider uppercase"
            disabled={agents.length < 1 || entering}
            onClick={onEnterVillage}
          >
            {entering ? "Entering..." : "Enter Village"}
          </button>
          <button
            className="font-pixel text-[8px] text-wood underline hover:text-ink"
            onClick={() => {
              setPhase("input");
              setMessages([]);
              onAgents([]);
            }}
          >
            Start over
          </button>
          {error && (
            <span className="font-pixel text-[8px] text-red-400">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Agent Form Modal */}
      {showAgentForm && (
        <AgentFormModal
          initial={editingIndex !== null && editingIndex > 0 ? agents[editingIndex - 1] : null}
          usedSpriteKeys={[leaderAvatar.spriteKey, ...agents.map(a => a.spriteKey)]}
          onSave={handleSaveAgent}
          onDelete={editingIndex !== null ? handleDeleteAgent : undefined}
          onCancel={() => {
            setShowAgentForm(false);
            setEditingIndex(null);
          }}
        />
      )}
    </div>
  );
}

// ── Chat sub-components ──

function LeaderBubble({
  message,
  spriteKey,
  name,
}: {
  message: string;
  spriteKey: string;
  name: string;
}) {
  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <div
          className="w-16 h-16 pixelated"
          style={{
            backgroundImage: `url(assets/sprites/characters/${spriteKey}.png)`,
            backgroundSize: "240px 320px",
            backgroundPosition: "-80px 0px",
          }}
        />
        <span className="font-pixel text-[7px] text-wood block text-center">
          {name}
        </span>
      </div>
      <div className="pixel-panel px-3 py-2 flex-1">
        <p className="font-pixel text-[9px] text-ink leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
      </div>
    </div>
  );
}

function UserBubble({
  message,
  spriteKey,
  name
}: {
  message: string;
  spriteKey: string;
  name: string;
}) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="pixel-inset px-3 py-2 max-w-[70%]">
        <p className="font-pixel text-[9px] text-ink leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <div
          className="w-16 h-16 pixelated"
          style={{
            backgroundImage: `url(assets/sprites/characters/${spriteKey}.png)`,
            backgroundSize: "240px 320px",
            backgroundPosition: "-80px 0px",
          }}
        />
        <span className="font-pixel text-[7px] text-wood block text-center">
          {name}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[8px] text-wood animate-pulse">
        {name} is thinking...
      </span>
    </div>
  );
}
