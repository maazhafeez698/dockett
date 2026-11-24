import { PLANS, getPlan, type PlanDefinition, type PlanKey } from "./plans";

export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "PAUSED" | "CANCELED";

export interface SubscriptionState {
  planKey: string;
  status: SubscriptionStatus;
  source: "PADDLE" | "MANUAL";
  graceUntil: Date | null;
}

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
