export type FormTemplateId =
  | "CORPORATE"
  | "SURVEY"
  | "EDUCATION"
  | "DEVELOPER"
  | "RETRO"
  | "INVITATION"
  | "TICKET"
  | "LANDING"
  | "CLASSIC";

export interface TemplateDesign {
  id: FormTemplateId;
  name: string;
  category: string;
  tagline: string;
  /** Two-stop gradient, used sparingly (badges, thin accent strips) - the
   * shells themselves mostly do NOT rely on a gradient hero, that was the
   * old theme system's move. */
  accentGradient: [string, string];
  accent: string;
  badgeClass: string;
  fieldBackground: string;
  fieldForeground: string;
  fontFamily: string;
  cornerRadius: string;
  surface: string;
  panel?: string;
  mutedForeground?: string;
  border?: string;
  foreground: string;
  accentForeground: string;
}

export interface TemplateCustomization {
  accentColor?: string;
  surfaceMode?: "LIGHT" | "DARK";
  typography?: "SANS" | "SERIF" | "MONO";
  corners?: "SOFT" | "SHARP";
}

export const TEMPLATE_DESIGNS: Record<FormTemplateId, TemplateDesign> = {
  CORPORATE: {
    id: "CORPORATE",
    name: "Job Application",
    category: "Professional",
    tagline: "A calm, structured candidate experience built for hiring teams.",
    accentGradient: ["#1E293B", "#334155"],
    accent: "#334155",
    badgeClass: "bg-slate-500/15 text-slate-300",
    fieldBackground: "#FFFFFF",
    fieldForeground: "#0F172A",
    fontFamily: "Arial, sans-serif", cornerRadius: "10px", surface: "#F8FAFC", foreground: "#0F172A", accentForeground: "#FFFFFF",
  },
  SURVEY: {
    id: "SURVEY",
    name: "Customer Feedback",
    category: "Feedback",
    tagline: "A low-friction pulse check that makes thoughtful feedback easy.",
    accentGradient: ["#0F766E", "#2DD4BF"],
    accent: "#2DD4BF",
    badgeClass: "bg-teal-500/15 text-teal-300",
    fieldBackground: "rgba(15, 118, 110, 0.12)",
    fieldForeground: "#CCFBF1",
    fontFamily: "Arial, sans-serif", cornerRadius: "18px", surface: "#F0FDFA", foreground: "#134E4A", accentForeground: "#04211D",
  },
  EDUCATION: {
    id: "EDUCATION",
    name: "Course Enrollment",
    category: "Academic",
    tagline: "A welcoming enrollment sheet with clear academic structure.",
    accentGradient: ["#166534", "#4ADE80"],
    accent: "#4ADE80",
    badgeClass: "bg-green-500/15 text-green-300",
    fieldBackground: "#FFFDF6",
    fieldForeground: "#14532D",
    fontFamily: "Georgia, serif", cornerRadius: "8px", surface: "#FFFDF6", foreground: "#14532D", accentForeground: "#FFFFFF",
  },
  DEVELOPER: {
    id: "DEVELOPER",
    name: "Bug Report",
    category: "Technical",
    tagline: "A focused engineering intake with a code-editor workspace.",
    accentGradient: ["#052e16", "#22C55E"],
    accent: "#22C55E",
    badgeClass: "bg-emerald-500/15 text-emerald-300 font-mono",
    fieldBackground: "#111A11",
    fieldForeground: "#D1FAE5",
    fontFamily: "ui-monospace, monospace", cornerRadius: "8px", surface: "#0A0F0A", foreground: "#D1FAE5", accentForeground: "#07120D",
  },
  RETRO: {
    id: "RETRO",
    name: "Retro Guestbook",
    category: "Nostalgic",
    tagline: "A warm, playful web-era guestbook with nostalgic browser chrome.",
    accentGradient: ["#1E3A8A", "#60A5FA"],
    accent: "#0A246A",
    badgeClass: "bg-blue-500/15 text-blue-300",
    fieldBackground: "#FFFFFF",
    fieldForeground: "#000000",
    fontFamily: "Tahoma, Arial, sans-serif", cornerRadius: "0px", surface: "#C0C0C0", foreground: "#111827", accentForeground: "#FFFFFF",
  },
  INVITATION: {
    id: "INVITATION",
    name: "Event RSVP",
    category: "Events",
    tagline: "An elegant RSVP card for weddings, dinners, and celebrations.",
    accentGradient: ["#78350F", "#D4AF37"],
    accent: "#B8860B",
    badgeClass: "bg-amber-500/15 text-amber-300",
    fieldBackground: "#FBF6EC",
    fieldForeground: "#3B2A12",
    fontFamily: "Georgia, serif", cornerRadius: "4px", surface: "#FBF6EC", foreground: "#3B2A12", accentForeground: "#3B2A12",
  },
  TICKET: {
    id: "TICKET",
    name: "IT Support Request",
    category: "Operations",
    tagline: "A professional service desk intake with clear next steps.",
    accentGradient: ["#7C2D12", "#FB923C"],
    accent: "#FB923C",
    badgeClass: "bg-orange-500/15 text-orange-300",
    fieldBackground: "#1E1A17",
    fieldForeground: "#F5F5F5",
    fontFamily: "Arial, sans-serif", cornerRadius: "10px", surface: "#161311", foreground: "#F5F5F5", accentForeground: "#111827",
  },
  LANDING: {
    id: "LANDING",
    name: "Newsletter Waitlist",
    category: "Marketing",
    tagline: "A confident launch page for subscribers and early access leads.",
    accentGradient: ["#701A75", "#E879F9"],
    accent: "#E879F9",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-300",
    fieldBackground: "#12071A",
    fieldForeground: "#FFFFFF",
    fontFamily: "Arial, sans-serif", cornerRadius: "18px", surface: "#12071A", foreground: "#FFFFFF", accentForeground: "#2A0A38",
  },
  CLASSIC: {
    id: "CLASSIC",
    name: "Classic",
    category: "Default",
    tagline: "The plain Dockett look — a punched-ticket card.",
    accentGradient: ["#312E81", "#6366F1"],
    accent: "#6366F1",
    badgeClass: "bg-indigo-500/15 text-indigo-300",
    fieldBackground: "rgba(255, 255, 255, 0.1)",
    fieldForeground: "#F5F5FF",
    fontFamily: "Arial, sans-serif", cornerRadius: "12px", surface: "#171729", foreground: "#F5F5FF", accentForeground: "#FFFFFF",
  },
};

const DARK_PALETTES: Record<
  FormTemplateId,
  { surface: string; panel: string; field: string; foreground: string; muted: string; border: string }
> = {
  CORPORATE: { surface: "#0B1220", panel: "#111B2C", field: "#1A2940", foreground: "#E8EEF7", muted: "#A8B6CA", border: "#34445B" },
  SURVEY: { surface: "#071B1A", panel: "#0D2927", field: "#153936", foreground: "#E6F7F3", muted: "#A7C8C1", border: "#28514B" },
  EDUCATION: { surface: "#101B17", panel: "#182720", field: "#22382D", foreground: "#F0F3E8", muted: "#BAC8B1", border: "#405748" },
  DEVELOPER: { surface: "#080D13", panel: "#111923", field: "#17212D", foreground: "#E5EDF7", muted: "#9AA8B8", border: "#303844" },
  RETRO: { surface: "#111827", panel: "#1D2638", field: "#151D2B", foreground: "#EEF2FF", muted: "#B3C0DA", border: "#53617A" },
  INVITATION: { surface: "#1B1712", panel: "#282219", field: "#342B20", foreground: "#F4EBD9", muted: "#CDBB9B", border: "#5D4B31" },
  TICKET: { surface: "#0D1622", panel: "#162337", field: "#1E3048", foreground: "#E8EFF9", muted: "#A9B8CC", border: "#344A65" },
  LANDING: { surface: "#180D1E", panel: "#24122D", field: "#321B3E", foreground: "#FAEEFC", muted: "#D0B9D6", border: "#593766" },
  CLASSIC: { surface: "#171729", panel: "#202036", field: "#292940", foreground: "#F5F5FF", muted: "#B6B6CC", border: "#45455F" },
};

// Gallery order — CLASSIC intentionally omitted (see file header). 
export const GALLERY_TEMPLATE_IDS: FormTemplateId[] = [
  "CORPORATE",
  "SURVEY",
  "EDUCATION",
  "DEVELOPER",
  "RETRO",
  "INVITATION",
  "TICKET",
  "LANDING",
];

export function getTemplateDesign(id: string | null | undefined, customization?: TemplateCustomization): TemplateDesign {
  const base = TEMPLATE_DESIGNS[(id as FormTemplateId) ?? "CLASSIC"] ?? TEMPLATE_DESIGNS.CLASSIC;
  const dark = customization?.surfaceMode === "DARK";
  const typography = customization?.typography;
  const accent = customization?.accentColor ?? base.accent;
  const rgb = accent.match(/[0-9A-Fa-f]{2}/g)?.map((part) => parseInt(part, 16) / 255) ?? [0, 0, 0];
  const luminance = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const accentForeground = 0.2126 * (luminance[0] ?? 0) + 0.7152 * (luminance[1] ?? 0) + 0.0722 * (luminance[2] ?? 0) > 0.43 ? "#111827" : "#FFFFFF";
  const darkPalette = DARK_PALETTES[base.id];
  return {
    ...base,
    accent,
    accentGradient: [customization?.accentColor ?? base.accentGradient[0], customization?.accentColor ?? base.accentGradient[1]],
    fontFamily: typography === "SERIF" ? "Georgia, 'Times New Roman', serif" : typography === "MONO" ? "ui-monospace, SFMono-Regular, monospace" : "Arial, Helvetica, sans-serif",
    cornerRadius: customization?.corners === "SHARP" ? "2px" : customization?.corners === "SOFT" ? "18px" : base.cornerRadius,
    surface: dark ? darkPalette.surface : base.surface,
    panel: dark ? darkPalette.panel : base.surface,
    mutedForeground: dark ? darkPalette.muted : base.foreground,
    border: dark ? darkPalette.border : "rgba(15, 23, 42, 0.16)",
    foreground: dark ? darkPalette.foreground : base.foreground,
    fieldBackground: dark ? darkPalette.field : base.fieldBackground,
    fieldForeground: dark ? darkPalette.foreground : base.fieldForeground,
    accentForeground,
  };
}
