import { useEffect, useMemo, useState } from "react";
import type { AgentInspectData } from "../phaser/registry/AgentRegistry";
import { useAgents } from "../hooks/useAgents";
import { ALL_SPRITES } from "../types/agents";
import { AgentInspector } from "./RightSidebar/AgentInspector";
import { ChatLog } from "./RightSidebar/ChatLog";
import { OutputLog } from "./RightSidebar/OutputLog";

interface Props {
  inspectData: AgentInspectData | null;
  onCloseInspect: () => void;
  userName?: string;
  userAvatarSrc?: string;
}

export function RightSidebar({ inspectData, onCloseInspect, userName, userAvatarSrc }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { agents } = useAgents();

  const agentAvatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a, i) => {
      const path = ALL_SPRITES[i % ALL_SPRITES.length].path;
      const displayName = a.id
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      map[displayName] = path;
      map[a.id] = path;
    });
    return map;
  }, [agents]);

  // Auto-expand when an agent is inspected
  useEffect(() => {
    if (inspectData) setCollapsed(false);
  }, [inspectData]);

  return (
    <div className="absolute right-0 top-0 h-full z-40 flex">
      {/* Collapse toggle — always visible */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="self-center pixel-btn px-0.5 py-2 text-[10px] text-ink leading-none z-10"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "\u25C0" : "\u25B6"}
      </button>

      {/* Sidebar panel */}
      <div
        className={`h-full pixel-panel pixel-dither font-pixel flex flex-col transition-all duration-200 ${
          collapsed ? "w-0 overflow-hidden opacity-0" : "w-[240px]"
        }`}
      >
        {/* Title bar */}
        <div className="px-3 py-2 flex items-center gap-2 bg-wood-dark text-parchment-light shrink-0">
          <span className="text-[10px] tracking-widest uppercase">Intel</span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Agent Inspector (conditional) */}
          {inspectData && (
            <>
              <AgentInspector
                data={inspectData}
                avatarSrc={ALL_SPRITES.find(s => s.key === inspectData.spriteKey)?.path}
                onClose={onCloseInspect}
              />
              <div className="pixel-sep mx-3" />
            </>
          )}

          {/* Chat Log */}
          <ChatLog agentAvatarMap={agentAvatarMap} userName={userName} userAvatarSrc={userAvatarSrc} />

          <div className="pixel-sep mx-3" />

          {/* Output Log */}
          <OutputLog />
        </div>
      </div>
    </div>
  );
}
