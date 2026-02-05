import { useTransition } from '../../state/WorldState';

export function TransitionOverlay() {
  const transition = useTransition();

  return (
    <div
      className="fixed inset-0 pointer-events-none bg-floor z-50"
      style={{
        opacity: 1 - transition.opacity,
        transition: 'opacity 100ms ease-in-out',
      }}
    />
  );
}
