interface LoginScreenProps {
  onEnter: () => void;
}

export function LoginScreen({ onEnter }: LoginScreenProps) {
  return (
    <div className="onboarding-overlay">
      <div className="pixel-panel px-12 py-10 flex flex-col items-center gap-6 max-w-md">
        <img
          src="assets/logo.png"
          alt="Panopticon"
          className="w-48 h-48 pixelated"
        />
        <p className="font-pixel text-[10px] text-wood tracking-widest uppercase text-center">
          The World Layer for AI Labor
        </p>
        <button
          className="pixel-btn font-pixel text-[12px] px-8 py-3 text-ink tracking-wider uppercase"
          onClick={onEnter}
        >
          Click to Enter
        </button>
      </div>
    </div>
  );
}
