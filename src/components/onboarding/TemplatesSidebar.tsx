import { TEMPLATES } from "../../types/onboarding";

interface TemplatesSidebarProps {
  onApply: (templateIndex: number) => void;
}

export function TemplatesSidebar({ onApply }: TemplatesSidebarProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-pixel text-[8px] text-wood uppercase tracking-widest">
        Templates
      </span>
      {TEMPLATES.map((t, i) => (
        <button
          key={t.label}
          className="pixel-btn font-pixel text-[9px] px-3 py-2 text-ink text-left"
          onClick={() => onApply(i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
