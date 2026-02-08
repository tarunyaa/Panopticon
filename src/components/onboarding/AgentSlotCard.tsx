import type { OnboardingAgent } from "../../types/onboarding";

const TOOL_SHORT_LABELS: Record<string, { emoji: string; label: string }> = {
  web_search: { emoji: "\ud83d\udd0d", label: "Search" },
  web_scraper: { emoji: "\ud83c\udf10", label: "Scrape" },
  terminal: { emoji: "\ud83d\udcbb", label: "Term" },
  file_writer: { emoji: "\ud83d\udcdd", label: "File" },
};

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
        className="pixel-btn flex flex-col items-center justify-center gap-0.5 p-2 h-[88px] w-full"
      >
        <span className="text-[16px] text-wood">+</span>
        <span className="font-pixel text-[7px] text-wood">Slot {index + 1}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`pixel-btn flex flex-col items-center gap-0.5 p-2 h-[88px] w-full relative ${
        isLeader ? "border-accent-amber" : ""
      }`}
    >
      {isLeader && (
        <span className="absolute top-0.5 right-0.5 font-pixel text-[6px] text-accent-amber uppercase">
          Leader
        </span>
      )}
      <div
        className="w-8 h-8 pixelated"
        style={{
          backgroundImage: `url(assets/sprites/characters/${agent.spriteKey}.png)`,
          backgroundSize: "96px 128px",
          backgroundPosition: "-32px 0px",
        }}
      />
      <span className="font-pixel text-[7px] text-ink truncate w-full text-center">
        {agent.name}
      </span>
      <span className="font-pixel text-[6px] text-wood truncate w-full text-center">
        {agent.role}
      </span>
      {agent.tools && agent.tools.length > 0 && (
        <div className="flex flex-wrap gap-0.5 justify-center">
          {agent.tools.map((t) => {
            const info = TOOL_SHORT_LABELS[t];
            return (
              <span
                key={t}
                className="font-pixel text-[6px] px-0.5 bg-parchment/50 text-wood rounded"
              >
                {info ? `${info.emoji}${info.label}` : t}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}
