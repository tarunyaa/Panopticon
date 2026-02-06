import { useState, type FormEvent } from 'react';
import { useWorldState } from '../../state/WorldState';
import { events } from '../../state/events';

/**
 * Login scene - pixel-art styled
 */
export function LoginScene() {
  const { dispatch, transitionTo } = useWorldState();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    dispatch(events.login(email.trim()));
    await new Promise(resolve => setTimeout(resolve, 200));
    transitionTo('world');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#E8DCC8' }}>
      <div
        className="bg-white p-8 w-full max-w-sm"
        style={{
          border: '2px solid #2B2B2B',
          boxShadow: '3px 3px 0 rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Pixel-art building icon */}
        <div className="flex justify-center mb-6">
          <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
            {/* Building base */}
            <rect x="8" y="14" width="16" height="14" fill="#5088C0" stroke="#2B2B2B" strokeWidth="1" />
            {/* Roof - stacked narrowing rects */}
            <rect x="6" y="12" width="20" height="3" fill="#385898" stroke="#2B2B2B" strokeWidth="1" />
            <rect x="10" y="8" width="12" height="5" fill="#385898" stroke="#2B2B2B" strokeWidth="1" />
            {/* Windows */}
            <rect x="10" y="17" width="3" height="3" fill="#FFD050" />
            <rect x="19" y="17" width="3" height="3" fill="#FFD050" />
            <rect x="10" y="22" width="3" height="3" fill="#FFD050" />
            <rect x="19" y="22" width="3" height="3" fill="#FFD050" />
            {/* Door */}
            <rect x="14" y="22" width="4" height="6" fill="#2B2B2B" />
            {/* Eye/camera on top */}
            <rect x="14" y="4" width="4" height="4" fill="#A070C0" stroke="#2B2B2B" strokeWidth="1" />
            <rect x="15" y="5" width="2" height="2" fill="#2B2B2B" />
          </svg>
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
              className="w-full px-4 py-3 outline-none text-text-dark placeholder:text-text-dark/40 text-sm font-mono"
              style={{
                border: '2px solid #2B2B2B',
                backgroundColor: '#F8F0E0',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="w-full py-3 font-medium text-sm transition-colors"
            style={{
              border: '2px solid #2B2B2B',
              backgroundColor: isSubmitting || !email.trim() ? '#D0C8B8' : '#5088C0',
              color: isSubmitting || !email.trim() ? '#4A4A4A' : 'white',
              boxShadow: isSubmitting || !email.trim() ? 'none' : '2px 2px 0 rgba(0,0,0,0.2)',
              cursor: isSubmitting || !email.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Entering...' : 'Enter'}
          </button>
        </form>

        {/* Hint */}
        <p className="text-center text-[10px] text-text-dark/40 mt-4">
          {'Any email works \u2022 Unknown domains \u2192 Acme Corp'}
        </p>
      </div>
    </div>
  );
}
