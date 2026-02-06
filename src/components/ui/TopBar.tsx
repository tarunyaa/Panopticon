import { useWorldState } from '../../state/WorldState';
import { LiveFeed } from './LiveFeed';

interface TopBarProps {
  showNav?: boolean;
}

const iconHome = new URL('../../assets/ui/icon_home.png', import.meta.url).href;
const iconPeople = new URL('../../assets/ui/icon_people.png', import.meta.url).href;
const iconClose = new URL('../../assets/ui/icon_close.png', import.meta.url).href;

/**
 * Top bar with minimal pixel-art icons: home, back, settings, sound toggle
 */
export function TopBar({ showNav = true }: TopBarProps) {
  const { state, transitionTo } = useWorldState();
  const { scene, liveFeed } = state;

  const canGoBack = scene !== 'login' && scene !== 'world';
  const canGoHome = scene !== 'login' && scene !== 'world';

  const handleBack = () => {
    if (scene === 'room' || scene === 'pod') {
      transitionTo('building', state.buildingId ?? state.orgId ?? undefined);
    } else if (scene === 'building' || scene === 'org') {
      transitionTo('world');
    }
  };

  const handleHome = () => {
    transitionTo('world');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-4 py-2 flex items-center justify-between">
      {/* Left: Navigation */}
      <div className="flex items-center gap-2">
        {showNav && (
          <>
            {/* Home button */}
            <button
              onClick={handleHome}
              disabled={!canGoHome}
              className={`
                w-8 h-8 flex items-center justify-center
                bg-white/90 border-2 border-[#2B2B2B] rounded-md
                transition-colors duration-150
                ${canGoHome ? 'hover:bg-[#FFD050] cursor-pointer' : 'opacity-40 cursor-not-allowed'}
              `}
              title="Home"
            >
              <img src={iconHome} alt="" width={16} height={16} style={{ imageRendering: 'pixelated' }} />
            </button>

            {/* Back button */}
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className={`
                w-8 h-8 flex items-center justify-center
                bg-white/90 border-2 border-[#2B2B2B] rounded-md
                transition-colors duration-150
                ${canGoBack ? 'hover:bg-[#FFD050] cursor-pointer' : 'opacity-40 cursor-not-allowed'}
              `}
              title="Back"
            >
              <img src={iconClose} alt="" width={16} height={16} style={{ imageRendering: 'pixelated' }} />
            </button>

            {/* People button (decorative for now) */}
            <button
              className="w-8 h-8 flex items-center justify-center
                bg-white/90 border-2 border-[#2B2B2B] rounded-md
                hover:bg-[#FFD050] transition-colors duration-150"
              title="Team"
            >
              <img src={iconPeople} alt="" width={16} height={16} style={{ imageRendering: 'pixelated' }} />
            </button>
          </>
        )}
      </div>

      {/* Center: Scene indicator (minimal) */}
      <div className="absolute left-1/2 -translate-x-1/2">
        {scene !== 'login' && (
        <div className="text-xs font-mono text-text-dark bg-white/90 border-2 border-[#2B2B2B] px-2 py-0.5 rounded-md shadow-soft">
            {scene === 'world' && 'Campus'}
            {scene === 'building' && (state.buildingId ?? 'Building')}
            {scene === 'room' && (state.roomId?.split('-').pop() ?? 'Room')}
            {scene === 'org' && state.orgId}
            {scene === 'pod' && state.podId?.split('-').pop()}
          </div>
        )}
      </div>

      {/* Right: Live Feed + Settings */}
      <div className="flex items-center gap-2">
        {scene !== 'login' && (
          <LiveFeed data={liveFeed} />
        )}

        {/* Settings */}
        <button
          className="w-8 h-8 flex items-center justify-center
            bg-white/90 border-2 border-[#2B2B2B] rounded-md
            hover:bg-[#FFD050] transition-colors duration-150"
          title="Settings"
        >
          <SettingsIcon />
        </button>

        {/* Sound toggle */}
        <button
          className="w-8 h-8 flex items-center justify-center
            bg-white/90 border-2 border-[#2B2B2B] rounded-md
            hover:bg-[#FFD050] transition-colors duration-150"
          title="Sound (placeholder)"
        >
          <SoundIcon />
        </button>
      </div>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
      {/* Gear shape - pixel cross + center */}
      <rect x="6" y="1" width="4" height="2" fill="#2B2B2B" />
      <rect x="6" y="13" width="4" height="2" fill="#2B2B2B" />
      <rect x="1" y="6" width="2" height="4" fill="#2B2B2B" />
      <rect x="13" y="6" width="2" height="4" fill="#2B2B2B" />
      {/* Diagonal teeth */}
      <rect x="3" y="3" width="2" height="2" fill="#2B2B2B" />
      <rect x="11" y="3" width="2" height="2" fill="#2B2B2B" />
      <rect x="3" y="11" width="2" height="2" fill="#2B2B2B" />
      <rect x="11" y="11" width="2" height="2" fill="#2B2B2B" />
      {/* Center body */}
      <rect x="4" y="4" width="8" height="8" fill="#2B2B2B" />
      {/* Center hole */}
      <rect x="6" y="6" width="4" height="4" fill="#E8E2D6" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: 'crispEdges' }}>
      {/* Speaker body */}
      <rect x="2" y="6" width="3" height="4" fill="#2B2B2B" />
      {/* Speaker cone */}
      <rect x="5" y="4" width="2" height="8" fill="#2B2B2B" />
      <rect x="7" y="3" width="1" height="10" fill="#2B2B2B" />
      {/* Sound waves (rect bars) */}
      <rect x="10" y="5" width="1" height="6" fill="#2B2B2B" />
      <rect x="12" y="3" width="1" height="10" fill="#2B2B2B" />
    </svg>
  );
}
