// packages/trpc/server/routes/form-submission/route.ts

import { TRPCError } from "@trpc/server";

import { authenticatedProcedure, optionalAuthProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formSubmissionService } from "../../services";
import { assertFormOwnership } from "@repo/services/form";

import {
  createSubmissionInputModel,
  createSubmissionOutputModel,
  getSubmissionsByFormIdInputModel,
  getSubmissionsByFormIdOutputModel,
} from "./model";

const TAGS = ["FormSubmission"];
const getPath = generatePath("/form-submission");

export const formSubmissionRouter = router({
  createSubmission: optionalAuthProcedure
    .meta({ openapi: { method: "POST", path: getPath("/createSubmission"), tags: TAGS } })
    .input(createSubmissionInputModel)
    .output(createSubmissionOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formSubmissionService.createSubmission({
          ...input,
          requesterId: ctx.user?.id,
        });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to submit form",
        });
      }
    }),
  getSubmissionsByFormId: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getSubmissionsByFormId"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getSubmissionsByFormIdInputModel)
    .output(getSubmissionsByFormIdOutputModel)
    .query(async ({ input, ctx }) => {
      const { formId } = input;

      // IDOR fix: this previously returned any form's submissions to any
      // signed-in user, not just the owner. Same "not found" message for a
      // non-owner and a nonexistent form, matching the rest of the app.
      try {
        await assertFormOwnership(formId, ctx.user.id);
      } catch {
        throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
      }

      const result = await formSubmissionService.getSubmissionsByFormId(formId);
      return result;
    }),
});

export default formSubmissionRouter;
