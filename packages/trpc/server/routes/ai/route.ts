import { TRPCError } from "@trpc/server";

import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { aiService } from "../../services";
import { isAiError } from "@repo/services/ai";

import {
  getAiUsageInputModel,
  getAiUsageOutputModel,
  saveAiDraftInputModel,
  saveAiDraftOutputModel,
  applyAiDraftInputModel,
  applyAiDraftOutputModel,
} from "./model";

const TAGS = ["AI"];
const getPath = generatePath("/ai");

function toTrpcError(error: unknown, fallback: string) {
  if (isAiError(error)) {
    const code =
      error.code === "FORM_NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "INVALID_REQUEST"
          ? "BAD_REQUEST"
          : "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: error.userMessage });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

/**
 * Note: generation itself is NOT a tRPC procedure. It streams over
 * Server-Sent Events at POST /ai/form/stream (see stream-handler.ts) because
 * tRPC's OpenAPI adapter is request/response only. These procedures cover
 * the non-streaming parts of the feature.
 */
export const aiRouter = router({
  getUsage: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/getUsage"), tags: TAGS, protect: true } })
    .input(getAiUsageInputModel)
    .output(getAiUsageOutputModel)
    .query(async ({ ctx }) => {
      try {
        return await aiService.getUsage(ctx.user.id);
      } catch (error) {
        throw toTrpcError(error, "Couldn't load AI usage");
      }
    }),

  saveDraftAsForm: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/saveDraftAsForm"), tags: TAGS, protect: true } })
    .input(saveAiDraftInputModel)
    .output(saveAiDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await aiService.saveDraftAsForm(ctx.user.id, input.draft);
      } catch (error) {
        throw toTrpcError(error, "Couldn't create the form");
      }
    }),

  applyDraftToForm: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/applyDraftToForm"), tags: TAGS, protect: true } })
    .input(applyAiDraftInputModel)
    .output(applyAiDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await aiService.applyDraftToForm(ctx.user.id, input.formId, input.draft);
      } catch (error) {
        throw toTrpcError(error, "Couldn't add the form to the canvas");
      }
    }),
});
