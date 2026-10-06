import { verifyCheckoutBinding } from "./signature";
import type { BillingConfig } from "./config";
import type { SubscriptionStatus } from "./entitlements";
import type { PlanKey } from "./plans";

/** Subset of Paddle's notification envelope that we rely on. */
export interface PaddleEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: Record<string, any>;
}

export const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
]);

/** What a subscription event says about the subscription, normalised. */
export interface SubscriptionSnapshot {
  paddleSubscriptionId: string;
  paddleCustomerId: string | null;
  /** Verified user id from signed checkout custom data; null if absent/invalid. */
  userId: string | null;
  status: SubscriptionStatus;
  planKey: PlanKey | null;
  priceId: string | null;
  billingCycle: "month" | "year" | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  paused: "PAUSED",
  canceled: "CANCELED",
};

function toDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Looks a Paddle price id up in the configured price → plan table. */
export function planForPrice(priceId: string | null, prices: BillingConfig["prices"]): { plan: PlanKey; cycle: "month" | "year" } | null {
  if (!priceId) return null;
  if (priceId === prices.premiumMonthly) return { plan: "premium", cycle: "month" };
  if (priceId === prices.premiumYearly) return { plan: "premium", cycle: "year" };
  return null;
}

/**
 * Pure: turn a subscription.* event into a snapshot. Never throws on odd
 * payloads — returns null when the event can't be understood.
 */
export function parseSubscriptionEvent(
  event: PaddleEvent,
  cfg: Pick<BillingConfig, "prices" | "webhookSecret">,
): SubscriptionSnapshot | null {
  if (!SUBSCRIPTION_EVENTS.has(event.event_type)) return null;
  const d = event.data;
  if (!d || typeof d.id !== "string") return null;

  const status = STATUS_MAP[String(d.status)];
  if (!status) return null;

  const items: Array<any> = Array.isArray(d.items) ? d.items : [];
  // The subscription's plan is decided by the first item whose price we recognise.
  let priceId: string | null = null;
  let match: ReturnType<typeof planForPrice> = null;
  for (const it of items) {
    const pid = typeof it?.price?.id === "string" ? it.price.id : null;
    const m = planForPrice(pid, cfg.prices);
    if (m) {
      priceId = pid;
      match = m;
      break;
    }
    priceId ??= pid;
  }

  const cd = d.custom_data && typeof d.custom_data === "object" ? d.custom_data : {};
  const userId =
    cfg.webhookSecret && verifyCheckoutBinding(cd.userId, cd.sig, cfg.webhookSecret) ? (cd.userId as string) : null;

  const interval = d.billing_cycle?.interval;
  return {
    paddleSubscriptionId: d.id,
    paddleCustomerId: typeof d.customer_id === "string" ? d.customer_id : null,
    userId,
    status,
    planKey: match?.plan ?? null,
    priceId,
    billingCycle: match?.cycle ?? (interval === "month" || interval === "year" ? interval : null),
    periodStart: toDate(d.current_billing_period?.starts_at),
    periodEnd: toDate(d.current_billing_period?.ends_at),
    cancelAtPeriodEnd: d.scheduled_change?.action === "cancel",
    canceledAt: toDate(d.canceled_at),
  };
}
