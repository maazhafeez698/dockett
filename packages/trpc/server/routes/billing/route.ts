import { TRPCError } from "@trpc/server";
import { logger } from "@repo/logger";

import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { billingService, userService } from "../../services";

import {
  createPortalSessionInputModel,
  createPortalSessionOutputModel,
  getBillingOverviewInputModel,
  getBillingOverviewOutputModel,
} from "./model";

const TAGS = ["Billing"];
const getPath = generatePath("/billing");

/**
 * Plan changes never happen here. These procedures only READ the plan and hand
 * out links; the plan itself changes exclusively through verified Paddle
 * webhooks (see webhook-handler.ts), so a client can never grant itself a plan.
 */
export const billingRouter = router({
  getOverview: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/getOverview"), tags: TAGS, protect: true } })
    .input(getBillingOverviewInputModel)
    .output(getBillingOverviewOutputModel)
    .query(async ({ ctx }) => {
      try {
        const user = await userService.getUserInfoById(ctx.user.id);
        return await billingService.getOverview(ctx.user.id, user.email);
      } catch (error) {
        logger.error("billing.overview_failed", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't load your plan" });
      }
    }),

  createPortalSession: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/createPortalSession"), tags: TAGS, protect: true } })
    .input(createPortalSessionInputModel)
    .output(createPortalSessionOutputModel)
    .mutation(async ({ ctx }) => {
      try {
        return await billingService.createPortalSession(ctx.user.id);
      } catch (error) {
        logger.warn("billing.portal_failed", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error && /no active subscription|aren't set up/i.test(error.message)
            ? error.message
            : "Couldn't open the billing portal. Please try again.",
        });
      }
    }),
});
