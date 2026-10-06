// apps/web/lib/plan-limit.ts
//
// The API refuses plan-restricted actions with a FORBIDDEN error whose `data.planLimit` says which
// limit was hit. These helpers turn that into a friendly toast with an "Upgrade" button.

import { toast } from "sonner";

export type PlanLimitCode =
  | "ACTIVE_FORMS_LIMIT"
  | "RESPONSES_LIMIT"
  | "PREMIUM_TEMPLATE"
  | "FORM_UNAVAILABLE";

export function getPlanLimitCode(err: unknown): PlanLimitCode | null {
  const code = (err as { data?: { planLimit?: unknown } } | null)?.data?.planLimit;
  return typeof code === "string" ? (code as PlanLimitCode) : null;
}

/** Shows the right toast for any error; plan-limit errors get an Upgrade action. Returns true if it was a plan limit. */
export function toastError(err: unknown, fallback: string, goToBilling: () => void): boolean {
  const message = err instanceof Error && err.message ? err.message : fallback;
  const code = getPlanLimitCode(err);
  if (code === "ACTIVE_FORMS_LIMIT" || code === "PREMIUM_TEMPLATE") {
    toast.error(message, { action: { label: "See plans", onClick: goToBilling }, duration: 8000 });
    return true;
  }
  toast.error(message);
  return code !== null;
}
