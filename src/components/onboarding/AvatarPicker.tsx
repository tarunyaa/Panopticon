import { AVATARS } from "../../types/agents";

interface AvatarPickerProps {
  selected: string | null;
  onSelect: (key: string) => void;
  /** Single key to exclude (e.g. the other picker's selection) */
  excludeKey?: string | null;
  /** Multiple keys to exclude (e.g. all avatars already on the team) */
  excludeKeys?: string[];
}

export function AvatarPicker({ selected, onSelect, excludeKey, excludeKeys }: AvatarPickerProps) {
  const excluded = new Set<string>();
  if (excludeKey) excluded.add(excludeKey);
  if (excludeKeys) excludeKeys.forEach((k) => excluded.add(k));

  return (
    <div className="grid grid-cols-4 gap-2">
      {AVATARS.map((avatar) => {
        const isSelected = selected === avatar.key;
        const isExcluded = excluded.has(avatar.key);
        return (
          <button
            key={avatar.key}
            onClick={() => !isExcluded && onSelect(avatar.key)}
            disabled={isExcluded}
            className={`flex flex-col items-center gap-1 p-2 border-2 ${
              isExcluded
                ? "opacity-30 cursor-not-allowed border-wood-dark"
                : isSelected
                  ? "pixel-btn-pressed border-accent-blue bg-parchment cursor-pointer"
                  : "pixel-btn border-wood-dark cursor-pointer"
            }`}
          >
            <div
              className={`w-12 h-12 pixelated${isExcluded ? " grayscale" : ""}`}
              style={{
                backgroundImage: `url(assets/sprites/characters/${avatar.key}.png)`,
                backgroundSize: "144px 192px",
                backgroundPosition: "-48px 0px",
              }}
            />
            <span className={`font-pixel text-[8px] ${isExcluded ? "text-gray-400" : "text-ink"}`}>
              {avatar.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
