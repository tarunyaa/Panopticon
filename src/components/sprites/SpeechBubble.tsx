import type { AgentStatus } from '../../types';

interface SpeechBubbleProps {
  status: AgentStatus;
  showLabel?: boolean;
}

const statusColors: Record<AgentStatus, string> = {
  working: 'bg-accent-green',
  idle: 'bg-accent-blue',
  blocked: 'bg-accent-coral',
  away: 'bg-gray-400',
};

const statusLabels: Record<AgentStatus, string> = {
  working: '...',
  idle: 'z',
  blocked: '!',
  away: '-',
};

export function SpeechBubble({ status, showLabel = true }: SpeechBubbleProps) {
  return (
    <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1">
      {/* Status dot */}
      <div
        className={`w-2 h-2 rounded-full ${statusColors[status]}`}
        style={{ boxShadow: '0 0 4px currentColor' }}
      />

      {/* Optional label */}
      {showLabel && (
        <div className="bg-white/90 px-1 rounded text-[10px] text-text-dark font-mono">
          {statusLabels[status]}
        </div>
      )}

      {/* Bubble tail */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: '3px solid transparent',
          borderRight: '3px solid transparent',
          borderTop: '4px solid rgba(255,255,255,0.9)',
        }}
      />
    </div>
  );
}
