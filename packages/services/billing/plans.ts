/**
 * THE source of truth for what each plan includes. Everything that enforces a
 * limit (services), shows a limit (pricing UI via tRPC) or syncs a limit (AI
 * credits) reads from here — change a number in this file and it changes
 * everywhere, with no other edits.
 *
 * Plan keys are what is stored in `subscriptions.plan_key`; "basic" is never
 * stored — it is simply the absence of a subscription in good standing.
 */

export type PlanKey = "basic" | "premium" | "business";

/** Key into the AI engine's plan table (packages/services/ai/config.ts). */
export type AiPlanKey = "free" | "pro" | "business";

/** The visual templates only Pro and above may use. */
export const PREMIUM_TEMPLATES = ["DEVELOPER", "RETRO", "TICKET"] as const;
export type PremiumTemplate = (typeof PREMIUM_TEMPLATES)[number];

export interface PlanLimits {
  /** Published ("active") forms at once. null = unlimited. */
  maxActiveForms: number | null;
  /** Submissions a single form can receive per calendar month. null = unlimited. */
  maxResponsesPerFormPerMonth: number | null;
}

export interface PlanFeatures {
  /** Developer, Retro and Ticket templates. */
  premiumTemplates: boolean;
}

export interface PlanHighlight {
  text: string;
  /** Shown with a "Coming soon" chip; not enforced because the feature doesn't exist yet. */
  soon?: boolean;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  tagline: string;
  /** USD. null = not sold by card (Basic is free, Business is contact-sales). */
  priceMonthlyUsd: number | null;
  priceYearlyUsd: number | null;
  /** Self-serve checkout allowed? Only Pro. */
  purchasable: boolean;
  contactSales: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  aiPlanKey: AiPlanKey;
  highlights: PlanHighlight[];
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  basic: {
    key: "basic",
    name: "Basic",
    tagline: "For trying things out and small projects.",
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    purchasable: false,
    contactSales: false,
    limits: { maxActiveForms: 5, maxResponsesPerFormPerMonth: 100 },
    features: { premiumTemplates: false },
    aiPlanKey: "free",
    highlights: [
      { text: "Up to 5 active forms" },
      { text: "100 responses / form / month" },
      { text: "Standard themes" },
      { text: "Basic analytics" },
      { text: "Limited AI generations" },
    ],
  },
  premium: {
    key: "premium",
    name: "Pro",
    tagline: "For creators who need more room and more polish.",
    priceMonthlyUsd: 5,
    // 10 months for 12 ("Save 16.7%"). Only offered if a yearly Paddle price id is configured.
    priceYearlyUsd: 50,
    purchasable: true,
    contactSales: false,
    limits: { maxActiveForms: 50, maxResponsesPerFormPerMonth: 1000 },
    features: { premiumTemplates: true },
    aiPlanKey: "pro",
    highlights: [
      { text: "Up to 50 active forms" },
      { text: "1,000 responses / form / month" },
      { text: "Pro themes" },
      { text: "Advanced analytics" },
      { text: "Increased AI generations" },
      { text: "Conditional rendering" },
      { text: "Personal customization"},
    ],
  },
  business: {
    key: "business",
    name: "Business",
    tagline: "For organizations with custom needs.",
    priceMonthlyUsd: null,
    priceYearlyUsd: null,
    purchasable: false,
    contactSales: true,
    limits: { maxActiveForms: null, maxResponsesPerFormPerMonth: null },
    features: { premiumTemplates: true },
    aiPlanKey: "business",
    highlights: [
      { text: "Unlimited everything" },
      { text: "Dedicated support" },
      { text: "On-demand integrations"},
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ["basic", "premium", "business"];

export function getPlan(key: string): PlanDefinition {
  return key in PLANS ? PLANS[key as PlanKey] : PLANS.basic;
}

export function isPremiumTemplate(template: string): boolean {
  return (PREMIUM_TEMPLATES as readonly string[]).includes(template);
}

/** The template that is actually served: a premium template falls back to CLASSIC when not entitled. */
export function effectiveTemplate<T extends string>(features: PlanFeatures, template: T): T | "CLASSIC" {
  return isPremiumTemplate(template) && !features.premiumTemplates ? "CLASSIC" : template;
}

/** Templates the AI may pick for a plan. */
export function allowedTemplatesFor(features: PlanFeatures, all: readonly string[]): string[] {
  return all.filter((t) => features.premiumTemplates || !isPremiumTemplate(t));
}

/** `limit === null` means unlimited. */
export function isAtLimit(count: number, limit: number | null): boolean {
  return limit !== null && count >= limit;
}

export function formatLimit(limit: number | null): string {
  return limit === null ? "unlimited" : limit.toLocaleString("en-US");
}
