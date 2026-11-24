import { TRPCError } from "@trpc/server";
import { isPlanLimitError } from "@repo/services/billing";

export function toPlanLimitTrpcError(error: unknown): TRPCError | null {
  if (!isPlanLimitError(error)) return null;
  if (error.planLimit === "FORM_UNAVAILABLE") {
    return new TRPCError({ code: "NOT_FOUND", message: error.message, cause: error });
  }
  return new TRPCError({ code: "FORBIDDEN", message: error.message, cause: error });
}
