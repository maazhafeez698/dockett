export type PlanLimitCode =
  | "ACTIVE_FORMS_LIMIT"
  | "RESPONSES_LIMIT"
  | "PREMIUM_TEMPLATE"
  | "FORM_UNAVAILABLE";

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
