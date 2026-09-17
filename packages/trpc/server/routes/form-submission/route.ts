// packages/trpc/server/routes/form-submission/route.ts

import { TRPCError } from "@trpc/server";

import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formSubmissionService } from "../../services";

import {
  createSubmissionInputModel,
  createSubmissionOutputModel,
  getSubmissionsByFormIdInputModel,
  getSubmissionsByFormIdOutputModel,
} from "./model";

const TAGS = ["FormSubmission"];
const getPath = generatePath("/form-submission");

export const formSubmissionRouter = router({
  createSubmission: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/createSubmission"), tags: TAGS } })
    .input(createSubmissionInputModel)
    .output(createSubmissionOutputModel)
    .mutation(async ({ input }) => {
      try {
        const result = await formSubmissionService.createSubmission(input as any);
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
    .query(async ({ input }) => {
      const { formId } = input;
      const result = await formSubmissionService.getSubmissionsByFormId(formId);
      return result;
    }),
});

export default formSubmissionRouter;
