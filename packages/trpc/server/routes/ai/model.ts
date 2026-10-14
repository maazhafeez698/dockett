import { z } from "zod";

const fieldTypeEnum = z.enum([
  "TEXT",
  "EMAIL",
  "NUMBER",
  "YES_NO",
  "LONG_TEXT",
  "DROPDOWN",
  "MULTI_SELECT",
  "CHECKBOX_GROUP",
  "DATE",
  "RATING",
  "RADIO_GROUP",
]);

export const aiDraftFieldModel = z.object({
  label: z.string().trim().min(1).max(100).describe("The question shown to respondents"),
  type: fieldTypeEnum.describe("Field type (PASSWORD is not allowed)"),
  description: z.string().trim().max(300).optional().describe("Helper text"),
  placeholder: z.string().trim().max(120).optional().describe("Placeholder text"),
  isRequired: z.boolean().default(false).describe("Whether an answer is required"),
  config: z
    .object({
      options: z.array(z.string().trim().min(1).max(200)).min(1).max(20).optional(),
      maxLength: z.number().int().positive().max(5000).optional(),
      max: z.number().int().min(2).max(10).optional(),
    })
    .nullable()
    .optional()
    .describe("Type-specific settings"),
});

export const aiDraftModel = z.object({
  title: z.string().trim().min(1).max(50).describe("Form title"),
  description: z.string().trim().max(300).optional().describe("Form description"),
  template: z
    .enum(["CORPORATE", "SURVEY", "EDUCATION", "DEVELOPER", "RETRO", "INVITATION", "TICKET", "LANDING", "CLASSIC"])
    .default("CLASSIC"),
  submissionLayout: z.enum(["ONE_AT_A_TIME", "ALL_AT_ONCE"]).default("ONE_AT_A_TIME"),
  fields: z.array(aiDraftFieldModel).min(1).max(100),
});

export const getAiUsageInputModel = z.undefined();
export const getAiUsageOutputModel = z.object({
  enabled: z.boolean().describe("False when AI is switched off or misconfigured"),
  planKey: z.string(),
  windowMs: z.number().describe("Length of one credit window in milliseconds"),
  percentUsed: z.number().describe("Credits consumed in this window, 0-100"),
  limitReached: z.boolean().describe("True when the window's credits are used up"),
  tokensUsed: z.number(),
  tokensLimit: z.number(),
  resetsAt: z.string().nullable().describe("ISO time the credits reset; null until the usage limit is reached"),
  maxPromptChars: z.number(),
});

export const saveAiDraftInputModel = z.object({ draft: aiDraftModel });
export const saveAiDraftOutputModel = z.object({ id: z.string().describe("ID of the created form") });

export const applyAiDraftInputModel = z.object({
  formId: z.uuid().describe("Form (canvas) to apply the draft to"),
  draft: aiDraftModel,
});
export const applyAiDraftOutputModel = z.object({
  added: z.number().describe("Number of fields added"),
  appliedSettings: z.boolean().describe("True when the form's title/description/template were applied too"),
});
