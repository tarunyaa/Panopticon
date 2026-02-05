import { WorldStateProvider, useWorldState } from './state/WorldState';
import { TopBar } from './components/ui/TopBar';
import { AgentCard } from './components/ui/AgentCard';
import { TransitionOverlay } from './components/canvas/TransitionOverlay';
import { LoginScene } from './components/scenes/LoginScene';
import { WorldScene } from './components/scenes/WorldScene';
import { OrgScene } from './components/scenes/OrgScene';
import { PodScene } from './components/scenes/PodScene';

/**
 * Main scene router - renders current scene based on state
 */
function SceneRouter() {
  const { state } = useWorldState();
  const { scene } = state;

  switch (scene) {
    case 'login':
      return <LoginScene />;
    case 'world':
      return <WorldScene />;
    case 'org':
      return <OrgScene />;
    case 'pod':
      return <PodScene />;
    default:
      return <LoginScene />;
  }
}

/**
 * App shell with state provider and UI chrome
 */
function AppShell() {
  const { state } = useWorldState();
  const showNav = state.scene !== 'login';

  return (
    <div className="h-screen w-screen overflow-hidden bg-floor">
      {/* Top bar */}
      <TopBar showNav={showNav} />

      {/* Main scene content */}
      <main className="h-full w-full pt-12">
        <SceneRouter />
      </main>

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
