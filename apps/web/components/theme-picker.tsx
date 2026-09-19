// apps/web/components/theme-picker.tsx

"use client";

import { Check } from "lucide-react";
import { FORM_THEMES } from "~/lib/form-themes";

interface ThemePickerProps {
  value: string;
  onChange: (key: string) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {FORM_THEMES.map((t) => {
        const selected = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`group relative aspect-[4/3] overflow-hidden rounded-xl border transition-all ${
              selected
                ? "border-transparent ring-2 ring-offset-2 ring-offset-background"
                : "border-border hover:scale-[1.02]"
            }`}
            style={{
              background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})`,
              ...(selected ? ({ "--tw-ring-color": t.accent } as React.CSSProperties) : {}),
            }}
            aria-pressed={selected}
          >
            <span
              className="absolute bottom-1.5 left-2 text-xs font-medium"
              style={{ color: t.onGradient }}
            >
              {t.label}
            </span>
            {selected && (
              <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-white/90">
                <Check className="size-3" style={{ color: t.accent }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
