// apps/web/lib/template-designs.ts
//
// Single source of truth for each template's identity — name, category
// badge, blurb, and the small set of colors used consistently across the
// gallery card, the builder's template picker, the dashboard list stripe,
// and (loosely) inside each template's own shell component. The actual
// structure/layout/interaction differences live in
// components/form-templates/*, not here — this file is just "what is this
// template called and what color is its badge."
//
// CLASSIC is deliberately excluded from GALLERY_TEMPLATE_IDS — it's the
// plain Formless look used for forms built from scratch, not something
// picked from the gallery.

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
  /** Two-stop gradient, used sparingly (badges, thin accent strips) — the
   * shells themselves mostly do NOT rely on a gradient hero, that was the
   * old theme system's move. */
  accentGradient: [string, string];
  accent: string;
  badgeClass: string;
  fieldBackground: string;
  fieldForeground: string;
}

export const TEMPLATE_DESIGNS: Record<FormTemplateId, TemplateDesign> = {
  CORPORATE: {
    id: "CORPORATE",
    name: "Corporate",
    category: "Professional",
    tagline: "Formal two-column layout with a numbered section rail.",
    accentGradient: ["#1E293B", "#334155"],
    accent: "#334155",
    badgeClass: "bg-slate-500/15 text-slate-300",
    fieldBackground: "#FFFFFF",
    fieldForeground: "#0F172A",
  },
  SURVEY: {
    id: "SURVEY",
    name: "Survey",
    category: "Feedback",
    tagline: "One focused question per screen, with a progress dial.",
    accentGradient: ["#0F766E", "#2DD4BF"],
    accent: "#2DD4BF",
    badgeClass: "bg-teal-500/15 text-teal-300",
    fieldBackground: "rgba(15, 118, 110, 0.12)",
    fieldForeground: "#CCFBF1",
  },
  EDUCATION: {
    id: "EDUCATION",
    name: "Education",
    category: "Academic",
    tagline: "Notebook-margin layout with a chalkboard header band.",
    accentGradient: ["#166534", "#4ADE80"],
    accent: "#4ADE80",
    badgeClass: "bg-green-500/15 text-green-300",
    fieldBackground: "#FFFDF6",
    fieldForeground: "#14532D",
  },
  DEVELOPER: {
    id: "DEVELOPER",
    name: "Developer Mode",
    category: "Technical",
    tagline: "A dark terminal window — fields render like a CLI prompt.",
    accentGradient: ["#052e16", "#22C55E"],
    accent: "#22C55E",
    badgeClass: "bg-emerald-500/15 text-emerald-300 font-mono",
    fieldBackground: "#111A11",
    fieldForeground: "#D1FAE5",
  },
  RETRO: {
    id: "RETRO",
    name: "Retro Desktop",
    category: "Nostalgic",
    tagline: "Beveled 90s desktop window, title bar included.",
    accentGradient: ["#1E3A8A", "#60A5FA"],
    accent: "#0A246A",
    badgeClass: "bg-blue-500/15 text-blue-300",
    fieldBackground: "#FFFFFF",
    fieldForeground: "#000000",
  },
  INVITATION: {
    id: "INVITATION",
    name: "Invitation",
    category: "Events",
    tagline: "Symmetric, cream-and-gold formal invitation layout.",
    accentGradient: ["#78350F", "#D4AF37"],
    accent: "#B8860B",
    badgeClass: "bg-amber-500/15 text-amber-300",
    fieldBackground: "#FBF6EC",
    fieldForeground: "#3B2A12",
  },
  TICKET: {
    id: "TICKET",
    name: "Ticket Desk",
    category: "Operations",
    tagline: "Kanban-ticket card styling with a status rail.",
    accentGradient: ["#7C2D12", "#FB923C"],
    accent: "#FB923C",
    badgeClass: "bg-orange-500/15 text-orange-300",
    fieldBackground: "#1E1A17",
    fieldForeground: "#F5F5F5",
  },
  LANDING: {
    id: "LANDING",
    name: "Launch Page",
    category: "Marketing",
    tagline: "Bold hero + feature bullets before a short field list.",
    accentGradient: ["#701A75", "#E879F9"],
    accent: "#E879F9",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-300",
    fieldBackground: "#12071A",
    fieldForeground: "#FFFFFF",
  },
  CLASSIC: {
    id: "CLASSIC",
    name: "Classic",
    category: "Default",
    tagline: "The plain Formless look — glass card on a soft gradient band.",
    accentGradient: ["#312E81", "#6366F1"],
    accent: "#6366F1",
    badgeClass: "bg-indigo-500/15 text-indigo-300",
    fieldBackground: "rgba(255, 255, 255, 0.1)",
    fieldForeground: "#F5F5FF",
  },
};

/** Gallery order — CLASSIC intentionally omitted (see file header). */
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

export function getTemplateDesign(id: string | null | undefined): TemplateDesign {
  return TEMPLATE_DESIGNS[(id as FormTemplateId) ?? "CLASSIC"] ?? TEMPLATE_DESIGNS.CLASSIC;
}
