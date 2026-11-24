import type { SubscriptionSnapshot } from "./webhook-parse";
import type { SubscriptionStatus } from "./entitlements";

// The existing row, as far as the update decision needs it. 
export interface ExistingSubscription {
  userId: string;
  planKey: string;
  source: "PADDLE" | "MANUAL";
  paddleSubscriptionId: string | null;
  status: SubscriptionStatus;
  graceUntil: Date | null;
  lastEventAt: Date | null;
}

export type ApplyDecision =
  | { action: "ignore"; reason: "unknown_plan" | "unknown_user" | "manual_override" | "superseded" }
  | { action: "stale" }
  | {
      action: "write";
      userId: string;
      values: {
        planKey: string;
        status: SubscriptionStatus;
        paddleSubscriptionId: string;
        paddleCustomerId: string | null;
        paddlePriceId: string | null;
        billingCycle: "month" | "year" | null;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        canceledAt: Date | null;
        graceUntil: Date | null;
        lastEventAt: Date;
      };
    };

export function decideUpdate(input: {
  snapshot: SubscriptionSnapshot;
  occurredAt: Date;
  existingByUser: ExistingSubscription | null;
  existingBySubscriptionId: ExistingSubscription | null;
  graceDays: number;
  now: Date;
}): ApplyDecision {
  const { snapshot: s, occurredAt, graceDays, now } = input;

  const userId = s.userId ?? input.existingBySubscriptionId?.userId ?? null;
  if (!userId) return { action: "ignore", reason: "unknown_user" };

  // The same Paddle subscription must never be attached to two different users.
  if (input.existingBySubscriptionId && input.existingBySubscriptionId.userId !== userId) {
    return { action: "ignore", reason: "unknown_user" };
  }

  const existing =
    input.existingBySubscriptionId && input.existingBySubscriptionId.userId === userId
      ? input.existingBySubscriptionId
      : input.existingByUser;

  if (existing?.source === "MANUAL") return { action: "ignore", reason: "manual_override" };

  const sameSub = !!existing && existing.paddleSubscriptionId === s.paddleSubscriptionId;

  // A subscription whose price we don't recognise can't grant anything. (If it IS the one we already
  // hold, e.g. a canceled event for a retired price, it is still applied so access can be revoked.)
  if (!s.planKey && !sameSub) return { action: "ignore", reason: "unknown_plan" };

  if (sameSub) {
    if (existing!.lastEventAt && occurredAt.getTime() < existing!.lastEventAt.getTime()) return { action: "stale" };
  } else if (existing && existing.status !== "CANCELED" && existing.status !== "PAUSED") {
    const freshPurchase =
      (s.status === "ACTIVE" || s.status === "TRIALING") &&
      (!existing.lastEventAt || occurredAt.getTime() >= existing.lastEventAt.getTime());
    if (!freshPurchase) return { action: "ignore", reason: "superseded" };
  }

  let graceUntil: Date | null = null;
  if (s.status === "PAST_DUE") {
    // Keep an already-running grace window; don't extend it on every retry event.
    graceUntil =
      sameSub && existing?.status === "PAST_DUE" && existing.graceUntil
        ? existing.graceUntil
        : new Date(now.getTime() + graceDays * 86_400_000);
  }

  return {
    action: "write",
    userId,
    values: {
      planKey: s.planKey ?? existing!.planKey,
      status: s.status,
      paddleSubscriptionId: s.paddleSubscriptionId,
      paddleCustomerId: s.paddleCustomerId,
      paddlePriceId: s.priceId,
      billingCycle: s.billingCycle,
      currentPeriodStart: s.periodStart,
      currentPeriodEnd: s.periodEnd,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      canceledAt: s.canceledAt,
      graceUntil,
      lastEventAt: occurredAt,
    },
  };
}
