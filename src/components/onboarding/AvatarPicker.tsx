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

  const avatars = AVATARS.filter((a) => !excluded.has(a.key));

  return (
    <div className="grid grid-cols-4 gap-2">
      {avatars.map((avatar) => {
        const isSelected = selected === avatar.key;
        return (
          <button
            key={avatar.key}
            onClick={() => onSelect(avatar.key)}
            className={`flex flex-col items-center gap-1 p-2 cursor-pointer border-2 ${
              isSelected
                ? "pixel-btn-pressed border-accent-blue bg-parchment"
                : "pixel-btn border-wood-dark"
            }`}
          >
            <div
              className="w-12 h-12 pixelated"
              style={{
                backgroundImage: `url(assets/sprites/characters/${avatar.key}.png)`,
                backgroundSize: "144px 192px",
                backgroundPosition: "-48px 0px",
              }}
            />
            <span className="font-pixel text-[8px] text-ink">{avatar.label}</span>
          </button>
        );
      })}
    </div>
  );
}
