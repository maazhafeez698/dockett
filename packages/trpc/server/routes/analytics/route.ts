// packages/trpc/server/routes/analytics/route.ts

import { TRPCError } from "@trpc/server";

import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formAnalyticsService } from "../../services";

import {
  getFormAnalyticsInputModel,
  getFormAnalyticsOutputModel,
  listSubmissionsInputModel,
  listSubmissionsOutputModel,
  getExportDataInputModel,
  getExportDataOutputModel,
  getSubmissionDetailInputModel,
  getSubmissionDetailOutputModel,
} from "./model";

const TAGS = ["Analytics"];
const getPath = generatePath("/analytics");

export const analyticsRouter = router({
  getFormAnalytics: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/getFormAnalytics"), tags: TAGS, protect: true },
    })
    .input(getFormAnalyticsInputModel)
    .output(getFormAnalyticsOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        return await formAnalyticsService.getFormAnalytics({
          formId: input.formId,
          userId: ctx.user.id,
          timeZone: input.timeZone,
        });
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Form not found",
        });
      }
    }),

  listSubmissions: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/listSubmissions"), tags: TAGS, protect: true },
    })
    .input(listSubmissionsInputModel)
    .output(listSubmissionsOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        return await formAnalyticsService.listSubmissions({
          formId: input.formId,
          userId: ctx.user.id,
        });
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Form not found",
        });
      }
    }),

  getExportData: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/getExportData"), tags: TAGS, protect: true },
    })
    .input(getExportDataInputModel)
    .output(getExportDataOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        return await formAnalyticsService.getExportData({
          formId: input.formId,
          userId: ctx.user.id,
        });
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Form not found",
        });
      }
    }),

  getSubmissionDetail: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getSubmissionDetail"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getSubmissionDetailInputModel)
    .output(getSubmissionDetailOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        return await formAnalyticsService.getSubmissionDetail({
          submissionId: input.submissionId,
          userId: ctx.user.id,
        });
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Submission not found",
        });
      }
    }),
});
