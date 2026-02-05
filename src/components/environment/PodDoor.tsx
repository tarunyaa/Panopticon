import type { Position } from '../../types';

interface PodDoorProps {
  id: string;
  name: string;
  position: Position;
  onClick: () => void;
  isUserPod?: boolean;
}

/**
 * Clickable pod entrance with hover glow + bounce
 * CSS-based pixel art style
 */
export function PodDoor({ id, name, position, onClick, isUserPod = false }: PodDoorProps) {
  return (
    <div
      className={`
        absolute cursor-pointer
        transition-all duration-150 ease-out
        hover:-translate-y-1
        group
      `}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
      onClick={onClick}
      role="button"
      aria-label={`Enter ${name} pod`}
    >
      {/* Hover glow effect */}
      <div
        className={`
          absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
          transition-opacity duration-150
        `}
        style={{
          background: `radial-gradient(ellipse at center, ${isUserPod ? '#7BA3C940' : '#8FBC8F40'} 0%, transparent 70%)`,
          transform: 'scale(1.3)',
          filter: 'blur(6px)',
        }}
      />

      {/* Pod room structure */}
      <div
        className="relative"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Room frame */}
        <div className="relative w-24 h-16 bg-wall rounded-t border-2 border-b-0 border-text-dark/20">
          {/* Interior shadow */}
          <div className="absolute inset-1 bg-floor/50 rounded-t" />

          {/* Desk inside */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-accent-coral/30 rounded-sm" />

          {/* Monitor on desk */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4 h-3 bg-text-dark/60 rounded-sm">
            <div className="absolute inset-0.5 bg-accent-blue/40 rounded-sm" />
          </div>
        </div>

        {/* Door */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-10 bg-text-dark/80 rounded-t border-2 border-text-dark/40">
          {/* Door window */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-3 bg-accent-blue/30 rounded-sm" />
          {/* Door handle */}
          <div className="absolute right-1 top-1/2 w-1 h-2 rounded bg-highlight" />
        </div>

        {/* Shadow */}
        <div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-20 h-2 rounded-full opacity-15"
          style={{ backgroundColor: '#000' }}
        />
      </div>

      {/* Label */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span
          className={`
            text-[10px] font-mono px-2 py-0.5 rounded
            ${isUserPod ? 'bg-accent-blue/20 text-accent-blue' : 'bg-floor/80 text-text-dark/70'}
          `}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
