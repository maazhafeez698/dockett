// apps/web/lib/form-themes.ts
//
// Named accent presets a form owner can pick for their form's public page.
// Deliberately a small, curated set (not a full color picker) — the point
// is a fast, good-looking choice, in the same vibrant-accent-card language
// as the design reference. Keep this in sync with the `theme` enum in
// packages/database/models/form.ts.

export interface FormTheme {
  key: string;
  label: string;
  /** Solid accent used for buttons, focus rings, and the picker swatch. */
  accent: string;
  /** Soft tint used behind the accent (progress bar track, subtle fills). */
  accentSoft: string;
  /** Two-stop gradient for the picker card and the public page's hero band. */
  gradient: [string, string];
  /** Text color that stays readable on top of the gradient. */
  onGradient: string;
}

export const FORM_THEMES: FormTheme[] = [
  {
    key: "MIDNIGHT",
    label: "Midnight",
    accent: "#6366F1",
    accentSoft: "#6366F11A",
    gradient: ["#312E81", "#6366F1"],
    onGradient: "#F5F5FF",
  },
  {
    key: "CORAL",
    label: "Coral",
    accent: "#F97362",
    accentSoft: "#F973621A",
    gradient: ["#F97362", "#FBB040"],
    onGradient: "#2A0F0A",
  },
  {
    key: "MINT",
    label: "Mint",
    accent: "#2DD4BF",
    accentSoft: "#2DD4BF1A",
    gradient: ["#0F766E", "#2DD4BF"],
    onGradient: "#F0FFFC",
  },
  {
    key: "LAVENDER",
    label: "Lavender",
    accent: "#A78BFA",
    accentSoft: "#A78BFA1A",
    gradient: ["#6D28D9", "#C4B5FD"],
    onGradient: "#F8F5FF",
  },
  {
    key: "OCEAN",
    label: "Ocean",
    accent: "#38BDF8",
    accentSoft: "#38BDF81A",
    gradient: ["#0369A1", "#38BDF8"],
    onGradient: "#F0F9FF",
  },
];

export const DEFAULT_FORM_THEME = "MIDNIGHT";

export function getFormTheme(key: string | null | undefined): FormTheme {
  return FORM_THEMES.find((t) => t.key === key) ?? FORM_THEMES[0]!;
}
