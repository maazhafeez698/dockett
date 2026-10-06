export type PlanLimitCode =
  | "ACTIVE_FORMS_LIMIT"
  | "RESPONSES_LIMIT"
  | "PREMIUM_TEMPLATE"
  | "FORM_UNAVAILABLE";

/**
 * Thrown when an action is refused because of the user's plan. `message` is
 * written for end users. The tRPC layer turns this into a FORBIDDEN error and
 * forwards `code` as `data.planLimit` so the web app can offer an upgrade
 * instead of just showing a toast.
 */
export class PlanLimitError extends Error {
  readonly planLimit: PlanLimitCode;

  constructor(code: PlanLimitCode, message: string) {
    super(message);
    this.name = "PlanLimitError";
    this.planLimit = code;
  }
}

export function isPlanLimitError(e: unknown): e is PlanLimitError {
  return e instanceof PlanLimitError;
}
