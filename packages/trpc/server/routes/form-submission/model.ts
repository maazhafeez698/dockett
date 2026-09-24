import { z } from "zod";

export const submissionValueModel = z.object({
  fieldId: z.uuid().describe("UUID of the form field"),
  value: z.string().describe("Submitted value as string"),
});

export const createSubmissionInputModel = z.object({
  formId: z.uuid().describe("UUID of the form"),
  values: z.array(submissionValueModel).describe("Array of field/value pairs"),
  accessCode: z.string().max(12).optional().describe("Code entered by the respondent, if prompted"),
});

export const createSubmissionOutputModel = z.object({
  id: z.string().describe("ID of the created submission"),
  createdAt: z.string().nullable().describe("Creation timestamp"),
});

export const getSubmissionsByFormIdInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to fetch submissions for"),
});

export const getSubmissionsByFormIdOutputModel = z.array(
  z.object({
    id: z.string(),
    formId: z.string().nullable(),
    submittedBy: z.string().nullable(),
    values: z.array(submissionValueModel),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
);
