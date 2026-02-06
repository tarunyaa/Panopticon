import { WorldStateProvider, useWorldState } from './state/WorldState';
import { TopBar } from './components/ui/TopBar';
import { AgentCard } from './components/ui/AgentCard';
import { TransitionOverlay } from './components/canvas/TransitionOverlay';
import { LoginScene } from './components/scenes/LoginScene';
import { PixiCanvas } from './components/pixi/PixiCanvas';

/**
 * App shell with state provider and UI chrome
 */
function AppShell() {
  const { state } = useWorldState();
  const isLogin = state.scene === 'login';
  const showNav = !isLogin;

  return (
    <div className="h-screen w-screen overflow-hidden bg-floor">
      {/* Top bar */}
      <TopBar showNav={showNav} />

      {/* Pixi canvas (game rendering, behind everything) */}
      <PixiCanvas />

      {/* Login scene (only rendered on login) */}
      {isLogin && (
        <main className="h-full w-full pt-12 relative z-10">
          <LoginScene />
        </main>
      )}

      {/* Agent card popup */}
      <AgentCard />

      {/* Transition overlay */}
      <TransitionOverlay />
    </div>
  );
}

/**
 * Root App component
 */
export default function App() {
  return (
    <WorldStateProvider>
      <AppShell />
    </WorldStateProvider>
  );
}
