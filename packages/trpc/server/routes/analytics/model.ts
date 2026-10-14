import { z } from "zod";

export const getFormAnalyticsInputModel = z.object({
  formId: z.uuid(),
  timeZone: z
    .string()
    .max(100)
    .refine((timeZone) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone")
    .optional(),
});

export const getFormAnalyticsOutputModel = z.object({
  totalResponses: z.number(),
  totalViews: z.number(),
  completionRate: z.number(),
  deviceBreakdown: z.object({
    DESKTOP: z.number(),
    MOBILE: z.number(),
    TABLET: z.number(),
    UNKNOWN: z.number(),
  }),
  timeline: z.array(z.object({ date: z.string(), count: z.number() })),
});

export const listSubmissionsInputModel = z.object({
  formId: z.uuid(),
});

export const listSubmissionsOutputModel = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    isComplete: z.boolean(),
    isAuthenticated: z.boolean(),
    createdAt: z.string().nullable(),
  }),
);

export const getExportDataInputModel = z.object({
  formId: z.uuid(),
});

export const getExportDataOutputModel = z.object({
  fields: z.array(z.object({ id: z.string(), label: z.string(), type: z.string() })),
  submissions: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string().nullable(),
      isAuthenticated: z.boolean(),
      values: z.array(z.object({ fieldId: z.string(), value: z.string() })),
    }),
  ),
});

export const getSubmissionDetailInputModel = z.object({
  submissionId: z.uuid(),
});

export const getSubmissionDetailOutputModel = z.object({
  id: z.string(),
  formId: z.string(),
  isAuthenticated: z.boolean(),
  createdAt: z.string().nullable(),
  answers: z.array(
    z.object({
      fieldId: z.string(),
      label: z.string(),
      type: z.string(),
      value: z.string(),
    }),
  ),
});
