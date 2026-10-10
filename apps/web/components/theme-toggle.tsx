// apps/web/components/theme-toggle.tsx

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  /** "icon": a square icon button. "row": icon + mono label (used in the sidebar). */
  variant?: "icon" | "row";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch: next-themes only knows the real theme
  // client-side, so render a placeholder until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={variant === "icon" ? "size-9" : "h-8"} />;

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`mono-label flex w-full items-center gap-2 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
      >
        <Icon className="size-3.5" />
        {isDark ? "Light mode" : "Dark mode"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex size-9 items-center justify-center rounded-sm border border-border bg-card text-foreground transition-colors hover:border-foreground/60 ${className ?? ""}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
