import { z } from "zod";

export const deviceEnum = z.enum(["DESKTOP", "MOBILE", "TABLET", "UNKNOWN"]);

export const recordViewInput = z.object({
  formId: z.uuid(),
  userAgent: z.string().optional(),
});
export type RecordViewInputType = z.infer<typeof recordViewInput>;

export const getFormAnalyticsInput = z.object({
  formId: z.uuid(),
  userId: z.uuid(),
});
export type GetFormAnalyticsInputType = z.infer<typeof getFormAnalyticsInput>;

export const getSubmissionDetailInput = z.object({
  submissionId: z.uuid(),
  userId: z.uuid(),
});
export type GetSubmissionDetailInputType = z.infer<typeof getSubmissionDetailInput>;
