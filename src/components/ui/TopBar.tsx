import { useWorldState } from '../../state/WorldState';
import { LiveFeed } from './LiveFeed';

interface TopBarProps {
  showNav?: boolean;
}

/**
 * Top bar with minimal icons: home, back, settings, sound toggle
 */
export function TopBar({ showNav = true }: TopBarProps) {
  const { state, transitionTo } = useWorldState();
  const { scene, liveFeed } = state;

  const canGoBack = scene !== 'login' && scene !== 'world';
  const canGoHome = scene !== 'login' && scene !== 'world';

  const handleBack = () => {
    if (scene === 'pod') {
      transitionTo('org', state.orgId ?? undefined);
    } else if (scene === 'org') {
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
                w-8 h-8 rounded-lg flex items-center justify-center
                bg-white/90 backdrop-blur-sm shadow-sm
                transition-all duration-150
                ${canGoHome ? 'hover:bg-white hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'}
              `}
              title="Home"
            >
              <HomeIcon />
            </button>

            {/* Back button */}
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center
                bg-white/90 backdrop-blur-sm shadow-sm
                transition-all duration-150
                ${canGoBack ? 'hover:bg-white hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed'}
              `}
              title="Back"
            >
              <BackIcon />
            </button>
          </>
        )}
      </div>

      {/* Center: Scene indicator (minimal) */}
      <div className="absolute left-1/2 -translate-x-1/2">
        {scene !== 'login' && (
          <div className="text-xs font-mono text-text-dark/50 bg-white/60 px-2 py-0.5 rounded">
            {scene === 'world' && 'Campus'}
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

        {/* Settings placeholder */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center
            bg-white/90 backdrop-blur-sm shadow-sm
            hover:bg-white hover:scale-105 transition-all duration-150"
          title="Settings"
        >
          <SettingsIcon />
        </button>

        {/* Sound toggle placeholder */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center
            bg-white/90 backdrop-blur-sm shadow-sm
            hover:bg-white hover:scale-105 transition-all duration-150"
          title="Sound (placeholder)"
        >
          <SoundIcon />
        </button>
      </div>
    </div>
  );
}

// Simple pixel-style icons
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L2 7V14H6V10H10V14H14V7L8 2Z" fill="#4A4A4A" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" fill="#4A4A4A" />
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3 3L4.5 4.5M11.5 11.5L13 13M3 13L4.5 11.5M11.5 4.5L13 3" stroke="#4A4A4A" strokeWidth="1.5" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 6H1V10H3L7 13V3L3 6Z" fill="#4A4A4A" />
      <path d="M10 5C11.5 6 11.5 10 10 11M12 3C15 5 15 11 12 13" stroke="#4A4A4A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
