import { useWorldState } from '../../state/WorldState';
import { events } from '../../state/events';
import { getAgent } from '../../data/mockData';
import { PlaceholderSprite } from '../sprites/Sprite';
import type { AgentStatus, CharacterType } from '../../types';

const statusColors: Record<AgentStatus, string> = {
  working: 'bg-accent-green',
  idle: 'bg-accent-blue',
  blocked: 'bg-accent-coral',
  away: 'bg-gray-400',
};

const typeColors: Record<CharacterType, string> = {
  human: '#7BA3C9',
  manager: '#B8A9C9',
  agent: '#8FBC8F',
};

/**
 * Agent card popup - pixel-art styled, shows when clicking an agent in pod view
 */
export function AgentCard() {
  const { state, dispatch } = useWorldState();
  const { selectedAgentId } = state;

  if (!selectedAgentId) return null;

  const agent = getAgent(selectedAgentId);
  if (!agent) return null;

  const handleClose = () => {
    dispatch(events.closeAgentCard());
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Card - sharp pixel box, flat shadow, pixel-pop-in animation */}
      <div
        className="relative bg-white p-4 min-w-[160px]"
        style={{
          imageRendering: 'auto',
          border: '2px solid #2B2B2B',
          boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
          animation: 'pixel-pop-in 300ms steps(2) both',
        }}
      >
        {/* Close button - sharp rect, not rounded */}
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 w-6 h-6 bg-wall
            flex items-center justify-center text-text-dark hover:bg-gray-300
            transition-colors"
          style={{ border: '2px solid #2B2B2B' }}
        >
          <span className="text-sm leading-none">x</span>
        </button>

        {/* Avatar */}
        <div className="flex justify-center mb-3">
          <PlaceholderSprite
            width={16}
            height={24}
            scale={3}
            color={typeColors[agent.type]}
            hasEyes={true}
          />
        </div>

        {/* Info */}
        <div className="text-center">
          {/* Name */}
          <div className="font-medium text-text-dark text-sm">
            {agent.name}
          </div>

          {/* Role */}
          <div className="text-xs text-text-dark/60 mb-2">
            {agent.role}
          </div>

          {/* Status - square dot instead of rounded */}
          <div className="flex items-center justify-center gap-1.5">
            <div className={`w-2 h-2 ${statusColors[agent.status]}`} />
            <span className="text-xs text-text-dark/70 capitalize">
              {agent.status}
            </span>
          </div>
        </div>
      </div>

      {/* Keyframes for pixel-pop-in animation */}
      <style>{`
        @keyframes pixel-pop-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
