import { z } from "zod";

export const createFormInput = z.object({
  title: z.string().max(50).describe("Title of the form"),
  description: z.string().max(300).optional().describe("Description of the form"),
  createdBy: z.uuid().describe("UUID of the creator"),
});

export type CreateFormInputType = z.infer<typeof createFormInput>;

export const listFormsByUserIdInput = z.object({
  userId: z.uuid().describe("UUID of the user"),
});

export type ListFormsByUserIdInputType = z.infer<typeof listFormsByUserIdInput>;

export const updateFormInput = z.object({
  formId: z.uuid().describe("UUID of the form to update"),
  userId: z.uuid().describe("UUID of the user making the request"),
  title: z.string().min(1).max(50).optional().describe("New title of the form"),
  description: z.string().max(300).nullable().optional().describe("New description of the form"),
  theme: z
    .enum(["MIDNIGHT", "CORAL", "MINT", "LAVENDER", "OCEAN"])
    .optional()
    .describe("Visual theme preset applied to the form's public page"),
  status: z
    .enum(["DRAFT", "PUBLISHED", "CLOSED"])
    .optional()
    .describe("Publish status of the form"),
  visibility: z
    .enum(["PUBLIC", "UNLISTED"])
    .optional()
    .describe("Who can find the form's public page"),
  submissionAccess: z
    .enum(["ANYONE", "AUTHENTICATED_ONLY", "ANONYMOUS_ONLY"])
    .optional()
    .describe(
      "Who is allowed to submit responses — not yet enforced, schema only until the visibility phase",
    ),
});

export type UpdateFormInputType = z.infer<typeof updateFormInput>;

export const deleteFormInput = z.object({
  formId: z.uuid().describe("UUID of the form to delete"),
  userId: z.uuid().describe("UUID of the user making the request"),
});

export type DeleteFormInputType = z.infer<typeof deleteFormInput>;
