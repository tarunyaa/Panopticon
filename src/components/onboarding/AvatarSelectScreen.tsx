import { AvatarPicker } from "./AvatarPicker";
import { AVATARS } from "../../types/agents";

interface AvatarSelectScreenProps {
  userAvatar: { spriteKey: string; name: string } | null;
  leaderAvatar: { spriteKey: string; name: string } | null;
  onUserAvatar: (avatar: { spriteKey: string; name: string }) => void;
  onLeaderAvatar: (avatar: { spriteKey: string; name: string }) => void;
  onNext: () => void;
}

export function AvatarSelectScreen({
  userAvatar,
  leaderAvatar,
  onUserAvatar,
  onLeaderAvatar,
  onNext,
}: AvatarSelectScreenProps) {
  const canProceed = userAvatar !== null && leaderAvatar !== null;

  return (
    <div className="onboarding-overlay">
      <div className="flex gap-6 max-w-3xl w-full px-4">
        {/* User avatar */}
        <div className="pixel-panel p-6 flex-1 flex flex-col gap-4">
          <h2 className="font-pixel text-[10px] text-ink tracking-widest uppercase text-center">
            Your Avatar
          </h2>
          <AvatarPicker
            selected={userAvatar?.spriteKey ?? null}
            onSelect={(key) => {
              const label = AVATARS.find((a) => a.key === key)?.label ?? key;
              onUserAvatar({ spriteKey: key, name: label });
            }}
            excludeKey={leaderAvatar?.spriteKey ?? null}
          />
        </div>

        {/* Leader avatar */}
        <div className="pixel-panel p-6 flex-1 flex flex-col gap-4">
          <h2 className="font-pixel text-[10px] text-ink tracking-widest uppercase text-center">
            Your Leader
          </h2>
          <AvatarPicker
            selected={leaderAvatar?.spriteKey ?? null}
            onSelect={(key) => {
              const label = AVATARS.find((a) => a.key === key)?.label ?? key;
              onLeaderAvatar({ spriteKey: key, name: label });
            }}
            excludeKey={userAvatar?.spriteKey ?? null}
          />
        </div>
      </div>

      {/* Next button */}
      <div className="absolute bottom-12">
        <button
          className="pixel-btn font-pixel text-[12px] px-10 py-3 text-ink tracking-wider uppercase"
          disabled={!canProceed}
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}
