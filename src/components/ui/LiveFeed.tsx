import type { LiveFeedData } from '../../types';

interface LiveFeedProps {
  data: LiveFeedData;
}

/**
 * Live Feed UI - shows running/blocked/approvals counts
 * Icons + small numbers only, minimal text
 */
export function LiveFeed({ data }: LiveFeedProps) {
  return (
    <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
      {/* Running */}
      <div className="flex items-center gap-1" title="Running">
        <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
        <span className="text-xs font-mono text-text-dark">{data.running}</span>
      </div>

      {/* Blocked */}
      <div
        className="flex items-center gap-1"
        title={data.blockedReason ?? 'Blocked'}
      >
        <div className="w-2 h-2 rounded-full bg-accent-coral" />
        <span className="text-xs font-mono text-text-dark">{data.blocked}</span>
      </div>

      {/* Approvals waiting */}
      <div className="flex items-center gap-1" title="Approvals waiting">
        <div className="w-2 h-2 rounded-full bg-highlight" />
        <span className="text-xs font-mono text-text-dark">{data.approvals}</span>
      </div>
    </div>
  );
}
