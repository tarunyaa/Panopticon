import { useState, type FormEvent } from 'react';
import { useWorldState } from '../../state/WorldState';
import { events } from '../../state/events';

/**
 * Login scene - email input with org fallback to "Acme"
 */
export function LoginScene() {
  const { dispatch, transitionTo } = useWorldState();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // Login (will parse org from email, fallback to Acme)
    dispatch(events.login(email.trim()));

    // Small delay for visual feedback, then transition
    await new Promise(resolve => setTimeout(resolve, 200));

    // Transition to world
    transitionTo('world');
  };

  return (
    <div className="min-h-screen bg-floor flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-sm">
        {/* Logo placeholder - pixel art style */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Simple pixel building icon */}
            <div className="w-16 h-16 relative" style={{ imageRendering: 'pixelated' }}>
              {/* Building base */}
              <div className="absolute bottom-0 left-2 right-2 h-12 bg-accent-blue rounded-t" />
              {/* Windows */}
              <div className="absolute bottom-8 left-4 w-2 h-2 bg-highlight" />
              <div className="absolute bottom-8 right-4 w-2 h-2 bg-highlight" />
              <div className="absolute bottom-4 left-4 w-2 h-2 bg-highlight" />
              <div className="absolute bottom-4 right-4 w-2 h-2 bg-highlight" />
              {/* Door */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-4 bg-text-dark rounded-t" />
              {/* Roof */}
              <div
                className="absolute top-2 left-0 right-0 h-4"
                style={{
                  background: 'linear-gradient(135deg, transparent 50%, #7BA3C9 50%)',
                }}
              />
            </div>

            {/* Eye/camera on top */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-accent-purple rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-text-dark rounded-full" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-lg font-medium text-text-dark mb-1">
          Panopticon
        </h1>
        <p className="text-center text-xs text-text-dark/60 mb-6">
          AI Labor Control Room
        </p>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
              className="w-full px-4 py-3 rounded-lg border border-wall
                focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20
                outline-none transition-all duration-150
                text-text-dark placeholder:text-text-dark/40
                text-sm font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className={`
              w-full py-3 rounded-lg font-medium text-sm
              transition-all duration-150
              ${isSubmitting || !email.trim()
                ? 'bg-wall text-text-dark/40 cursor-not-allowed'
                : 'bg-accent-blue text-white hover:bg-accent-blue/90 hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            {isSubmitting ? 'Entering...' : 'Enter'}
          </button>
        </form>

        {/* Hint */}
        <p className="text-center text-[10px] text-text-dark/40 mt-4">
          Any email works • Unknown domains → Acme Corp
        </p>
      </div>
    </div>
  );
}
