import type { LiveFeedData } from '../../types';

interface LiveFeedProps {
  data: LiveFeedData;
}

const iconRunning = new URL('../../assets/ui/icon_running.png', import.meta.url).href;
const iconBlocked = new URL('../../assets/ui/icon_blocked.png', import.meta.url).href;
const iconApproval = new URL('../../assets/ui/icon_approval.png', import.meta.url).href;

/**
 * Live Feed UI - shows running/blocked/approvals counts
 * Pixel-art style: sharp boxes, square dots, stepped blink
 */
export function LiveFeed({ data }: LiveFeedProps) {
  return (
    <div
      className="flex items-center gap-3 bg-white/90 px-3 py-1.5 rounded-md"
      style={{ border: '2px solid #2B2B2B', boxShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}
    >
      {/* Running */}
      <div className="flex items-center gap-1" title="Running">
        <img src={iconRunning} alt="" width={12} height={12} style={{ imageRendering: 'pixelated' }} />
        <span className="text-xs font-mono text-text-dark">{data.running}</span>
      </div>

      {/* Blocked */}
      <div
        className="flex items-center gap-1"
        title={data.blockedReason ?? 'Blocked'}
      >
        <img src={iconBlocked} alt="" width={12} height={12} style={{ imageRendering: 'pixelated' }} />
        <span className="text-xs font-mono text-text-dark">{data.blocked}</span>
      </div>

      {/* Approvals waiting */}
      <div className="flex items-center gap-1" title="Approvals waiting">
        <img src={iconApproval} alt="" width={12} height={12} style={{ imageRendering: 'pixelated' }} />
        <span className="text-xs font-mono text-text-dark">{data.approvals}</span>
      </div>
    </div>
  );
}
