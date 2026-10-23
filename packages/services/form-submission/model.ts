import { z } from "zod";

export const submissionValue = z.object({
  fieldId: z.uuid().describe("UUID of the form field"),
  value: z.string().describe("Submitted value as string"),
});

export const createSubmissionInput = z.object({
  formId: z.uuid().describe("UUID of the form"),
  values: z.array(submissionValue).describe("Array of field/value pairs"),
  requesterId: z.uuid().optional().describe("The form owner, if the owner is the one submitting"),
  accessCode: z.string().max(12).optional().describe("Code entered by the respondent, if prompted"),
  respondentToken: z
    .string()
    .max(2048)
    .optional()
    .describe("Credential from the email magic link (forms that verify respondents' email)"),
  idempotencyKey: z
    .string()
    .min(8)
    .max(64)
    .optional()
    .describe("Random id of this fill attempt: a retried request returns the original response"),
});

export const createSubmissionOutput = z.object({
  id: z.string().describe("ID of the created submission"),
  createdAt: z.string().nullable().describe("Creation timestamp"),
});

export type CreateSubmissionInputType = z.infer<typeof createSubmissionInput>;
export type CreateSubmissionOutputType = z.infer<typeof createSubmissionOutput>;
