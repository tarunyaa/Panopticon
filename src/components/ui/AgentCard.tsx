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
 * Agent card popup - shows when clicking an agent in pod view
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

      {/* Card */}
      <div
        className="relative bg-white rounded-xl shadow-xl p-4 min-w-[160px]
          animate-in fade-in zoom-in-95 duration-150"
        style={{ imageRendering: 'auto' }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 w-6 h-6 bg-wall rounded-full
            flex items-center justify-center text-text-dark hover:bg-gray-300
            transition-colors"
        >
          <span className="text-sm">×</span>
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

          {/* Status */}
          <div className="flex items-center justify-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
            <span className="text-xs text-text-dark/70 capitalize">
              {agent.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
