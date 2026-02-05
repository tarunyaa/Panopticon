import type { Position } from '../../types';

interface DeskProps {
  position: Position;
  hasComputer?: boolean;
  isActive?: boolean;
}

/**
 * Workstation desk - CSS-based pixel art
 */
export function Desk({ position, hasComputer = true, isActive = false }: DeskProps) {
  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        imageRendering: 'pixelated',
      }}
    >
      {/* Desk surface */}
      <div className="relative w-16 h-10 bg-accent-coral/40 rounded-sm border border-accent-coral/60">
        {/* Desk top highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 rounded-t-sm" />

        {/* Computer */}
        {hasComputer && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            {/* Monitor */}
            <div className="relative w-8 h-6 bg-text-dark/80 rounded-sm">
              {/* Screen */}
              <div
                className={`
                  absolute inset-0.5 rounded-sm
                  ${isActive ? 'bg-accent-blue/60' : 'bg-text-dark/40'}
                `}
              >
                {/* Screen glow effect when active */}
                {isActive && (
                  <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(123,163,201,0.3) 0%, transparent 70%)',
                    }}
                  />
                )}

                {/* Fake code lines */}
                {isActive && (
                  <div className="absolute inset-1 flex flex-col gap-0.5">
                    <div className="w-full h-0.5 bg-accent-green/60" />
                    <div className="w-3/4 h-0.5 bg-white/40" />
                    <div className="w-1/2 h-0.5 bg-white/40" />
                  </div>
                )}
              </div>

              {/* Monitor stand */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-text-dark/60" />
            </div>
          </div>
        )}

        {/* Keyboard */}
        {hasComputer && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-text-dark/40 rounded-sm" />
        )}
      </div>

      {/* Chair */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-4 bg-text-dark/30 rounded-t-full" />

      {/* Shadow */}
      <div
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-14 h-1 rounded-full opacity-10"
        style={{ backgroundColor: '#000' }}
      />
    </div>
  );
}
