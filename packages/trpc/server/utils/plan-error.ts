import { TRPCError } from "@trpc/server";
import { isPlanLimitError } from "@repo/services/billing";

/**
 * If `error` is a plan-limit refusal, returns the FORBIDDEN TRPCError the web app understands
 * (the original error is kept as `cause`, which the error formatter turns into `data.planLimit`).
 * Returns null otherwise so the caller can fall through to its normal mapping.
 */
export function toPlanLimitTrpcError(error: unknown): TRPCError | null {
  if (!isPlanLimitError(error)) return null;
  if (error.planLimit === "FORM_UNAVAILABLE") {
    return new TRPCError({ code: "NOT_FOUND", message: error.message, cause: error });
  }
  return new TRPCError({ code: "FORBIDDEN", message: error.message, cause: error });
}
