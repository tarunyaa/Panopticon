import type { Position } from '../../types';

interface TreeProps {
  position: Position;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Decorative tree - CSS-based pixel art
 */
export function Tree({ position, size = 'medium' }: TreeProps) {
  const sizes = {
    small: { width: 12, height: 20, trunk: 4 },
    medium: { width: 16, height: 28, trunk: 5 },
    large: { width: 22, height: 36, trunk: 6 },
  };

  const { width, height, trunk } = sizes[size];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        imageRendering: 'pixelated',
      }}
    >
      {/* Tree foliage - layered circles */}
      <div className="relative" style={{ width, height: height - trunk }}>
        {/* Top layer */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-accent-green"
          style={{ width: width * 0.6, height: width * 0.6 }}
        />
        {/* Middle layer */}
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: width * 0.85,
            height: width * 0.7,
            backgroundColor: '#7AAF7A',
          }}
        />
        {/* Bottom layer */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width,
            height: width * 0.8,
            backgroundColor: '#6A9F6A',
          }}
        />

        {/* Highlight */}
        <div
          className="absolute top-1 left-1/3 rounded-full bg-white/20"
          style={{ width: width * 0.2, height: width * 0.15 }}
        />
      </div>

      {/* Trunk */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm"
        style={{
          width: trunk,
          height: trunk + 2,
          backgroundColor: '#8B7355',
        }}
      />

      {/* Shadow */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full opacity-15"
        style={{
          width: width * 0.8,
          height: 3,
          backgroundColor: '#000',
        }}
      />
    </div>
  );
}
