import { useBlink } from '../../hooks/useBlink';
import { PlaceholderSprite } from './Sprite';
import { SpeechBubble } from './SpeechBubble';
import type { CharacterType, AgentStatus, Position } from '../../types';

interface CharacterProps {
  type: CharacterType;
  name: string;
  status?: AgentStatus;
  position: Position;
  onClick?: () => void;
  showBubble?: boolean;
  scale?: number;
}

// Color mapping for character types
const typeColors: Record<CharacterType, string> = {
  human: '#7BA3C9',    // blue for user
  manager: '#B8A9C9',  // purple for AI manager
  agent: '#8FBC8F',    // green for agents
};

/**
 * Character component with:
 * - Static PNG sprite (or placeholder)
 * - CSS idle bob animation
 * - JS-driven random blink
 * - Optional speech bubble
 */
export function Character({
  type,
  name,
  status = 'idle',
  position,
  onClick,
  showBubble = true,
  scale = 2,
}: CharacterProps) {
  const blinking = useBlink();

  return (
    <div
      className={`absolute ${onClick ? 'cursor-pointer hover:brightness-110' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)', // Anchor at feet
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Click ${name}` : undefined}
    >
      {/* Speech bubble */}
      {showBubble && (
        <SpeechBubble status={status} />
      )}

      {/* Character sprite with idle bob */}
      <div className="animate-idle-bob">
        <PlaceholderSprite
          width={16}
          height={24}
          scale={scale}
          color={typeColors[type]}
          hasEyes={true}
          blinking={blinking}
        />
      </div>

      {/* Name label (minimal) */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-[9px] text-text-dark/70 font-mono bg-floor/80 px-1 rounded">
          {name}
        </span>
      </div>
    </div>
  );
}
