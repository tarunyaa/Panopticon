import type { OnboardingAgent } from "../../types/onboarding";

interface AgentSlotCardProps {
  agent: OnboardingAgent | null;
  index: number;
  isLeader: boolean;
  onClick: () => void;
}

export function AgentSlotCard({ agent, index, isLeader, onClick }: AgentSlotCardProps) {
  if (!agent) {
    return (
      <button
        onClick={onClick}
        className="pixel-btn flex flex-col items-center justify-center gap-1 p-3 h-28 w-full"
      >
        <span className="text-[20px] text-wood">+</span>
        <span className="font-pixel text-[8px] text-wood">Slot {index + 1}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`pixel-btn flex flex-col items-center gap-1 p-3 h-28 w-full relative ${
        isLeader ? "border-accent-amber" : ""
      }`}
    >
      {isLeader && (
        <span className="absolute top-1 right-1 font-pixel text-[7px] text-accent-amber uppercase">
          Leader
        </span>
      )}
      <div
        className="w-10 h-10 pixelated"
        style={{
          backgroundImage: `url(assets/sprites/characters/${agent.spriteKey}.png)`,
          backgroundSize: "120px 160px",
          backgroundPosition: "-40px 0px",
        }}
      />
      <span className="font-pixel text-[8px] text-ink truncate w-full text-center">
        {agent.name}
      </span>
      <span className="font-pixel text-[7px] text-wood truncate w-full text-center">
        {agent.role}
      </span>
    </button>
  );
}
