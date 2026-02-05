import type { Position } from '../../types';

interface BuildingProps {
  id: string;
  name: string;
  position: Position;
  color: string;
  onClick: () => void;
  isUserOrg?: boolean;
}

/**
 * Clickable organization building with hover glow + bounce
 * CSS-based pixel art style
 */
export function Building({ id, name, position, color, onClick, isUserOrg = false }: BuildingProps) {
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
      aria-label={`Enter ${name}`}
    >
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{
          background: `radial-gradient(ellipse at center, ${color}40 0%, transparent 70%)`,
          transform: 'scale(1.5)',
          filter: 'blur(8px)',
        }}
      />

      {/* Building structure */}
      <div
        className="relative"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Main building body */}
        <div
          className="relative w-20 h-24 rounded-t-lg"
          style={{ backgroundColor: color }}
        >
          {/* Roof accent */}
          <div
            className="absolute -top-2 left-1 right-1 h-3 rounded-t"
            style={{ backgroundColor: `${color}CC` }}
          />

          {/* Windows - grid of 2x3 */}
          <div className="absolute top-4 left-2 right-2 grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-4 rounded-sm"
                style={{ backgroundColor: '#FFE4B5' }}
              />
            ))}
          </div>

          {/* Door */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-8 rounded-t"
            style={{ backgroundColor: '#4A4A4A' }}
          >
            {/* Door handle */}
            <div className="absolute right-1 top-1/2 w-1 h-1 rounded-full bg-highlight" />
          </div>
        </div>

        {/* Shadow */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-2 rounded-full opacity-20"
          style={{ backgroundColor: '#000' }}
        />
      </div>

      {/* Label */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span
          className={`
            text-[10px] font-mono px-2 py-0.5 rounded
            ${isUserOrg ? 'bg-accent-blue/20 text-accent-blue' : 'bg-floor/80 text-text-dark/70'}
          `}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
