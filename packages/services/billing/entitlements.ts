import { PLANS, getPlan, type PlanDefinition, type PlanKey } from "./plans";

export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "PAUSED" | "CANCELED";

/** The columns of `subscriptions` that decide access. */
export interface SubscriptionState {
  planKey: string;
  status: SubscriptionStatus;
  source: "PADDLE" | "MANUAL";
  graceUntil: Date | null;
}

/**
 * Which plan does this user have RIGHT NOW? The only function that answers it.
 *
 *  - no subscription, canceled, paused         → Basic
 *  - active / trialing                         → the subscribed plan
 *  - past_due (renewal payment failed)         → the subscribed plan until graceUntil, then Basic
 *  - cancel-at-period-end                      → stays ACTIVE until Paddle sends `canceled` at the period end
 *
 * An unknown plan key in the database fails SAFE to Basic.
 */
export function resolvePlanKey(sub: SubscriptionState | null | undefined, now: Date = new Date()): PlanKey {
  if (!sub) return "basic";
  const plan = sub.planKey in PLANS ? (sub.planKey as PlanKey) : "basic";
  if (plan === "basic") return "basic";

  switch (sub.status) {
    case "ACTIVE":
    case "TRIALING":
      return plan;
    case "PAST_DUE":
      return sub.graceUntil && now.getTime() < sub.graceUntil.getTime() ? plan : "basic";
    default:
      return "basic";
  }
}

export function resolvePlan(sub: SubscriptionState | null | undefined, now: Date = new Date()): PlanDefinition {
  return getPlan(resolvePlanKey(sub, now));
}
