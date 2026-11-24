import { TRPCError } from "@trpc/server";
import { TooManyRequestsError } from "@repo/services/user";

import { publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formRespondentService } from "../../services";
import {
  checkSessionInputModel,
  checkSessionOutputModel,
  requestLinkInputModel,
  requestLinkOutputModel,
  verifyLinkInputModel,
  verifyLinkOutputModel,
} from "./model";

const TAGS = ["FormRespondent"];
const getPath = generatePath("/form-respondent");

export const formRespondentRouter = router({
  requestLink: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/requestLink"), tags: TAGS } })
    .input(requestLinkInputModel)
    .output(requestLinkOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await formRespondentService.requestLink({ ...input, ip: ctx.ip });
      } catch (error) {
        if (error instanceof TooManyRequestsError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Couldn't send the link.",
        });
      }
    }),

  verifyLink: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/verifyLink"), tags: TAGS } })
    .input(verifyLinkInputModel)
    .output(verifyLinkOutputModel)
    .mutation(async ({ input }) => {
      try {
        return await formRespondentService.verify(input.token);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't verify the link. Please try again." });
      }
    }),

  checkSession: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/checkSession"), tags: TAGS } })
    .input(checkSessionInputModel)
    .output(checkSessionOutputModel)
    .mutation(async ({ input }) => formRespondentService.checkSession(input.formId, input.token)),
});

export default formRespondentRouter;
