import { z } from "zod";

export const formTemplateEnum = z.enum([
  "CORPORATE",
  "SURVEY",
  "EDUCATION",
  "DEVELOPER",
  "RETRO",
  "INVITATION",
  "TICKET",
  "LANDING",
  "CLASSIC",
]);

export const formSubmissionLayoutEnum = z.enum(["ONE_AT_A_TIME", "ALL_AT_ONCE"]);
// AUTHENTICATED_ONLY is deprecated (respondents no longer need an account); it is never accepted as input.
export const formAccessModeEnum = z.enum(["ANYONE", "ACCESS_CODE"]);
export const formSubmissionAccessEnum = z.enum(["ANYONE", "ACCESS_CODE", "AUTHENTICATED_ONLY"]);
export const formRespondentIdentityEnumSchema = z.enum(["ANONYMOUS", "VERIFIED_EMAIL"]);
export const formStatusEnumSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);

export const createFormInput = z.object({
  title: z.string().max(50).describe("Title of the form"),
  description: z.string().max(300).optional().describe("Description of the form"),
  createdBy: z.uuid().describe("UUID of the creator"),
  template: formTemplateEnum.optional().describe("Design template — defaults to CLASSIC"),
  submissionLayout: formSubmissionLayoutEnum
    .optional()
    .describe("Field pacing on the public page — defaults to ONE_AT_A_TIME"),
});

export type CreateFormInputType = z.infer<typeof createFormInput>;

// One template field, as passed from the template gallery when creating a
// form pre-populated from a preset — mirrors the create-field input shape
// closely enough that the service can loop straight into FormFieldService.
export const templateFieldInput = z.object({
  label: z.string().min(1).max(100),
  type: z.enum([
    "TEXT",
    "EMAIL",
    "NUMBER",
    "YES_NO",
    "PASSWORD",
    "LONG_TEXT",
    "DROPDOWN",
    "MULTI_SELECT",
    "CHECKBOX_GROUP",
    "DATE",
    "RATING",
    "RADIO_GROUP",
    "FILE_UPLOAD",
  ]),
  isRequired: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  description: z.string().max(1000).optional(),
  config: z
    .object({
      options: z.array(z.string().min(1).max(200)).max(50).optional(),
      maxLength: z.number().int().positive().max(5000).optional(),
      max: z.number().int().min(2).max(10).optional(),
      minValue: z.number().finite().optional(),
      maxValue: z.number().finite().optional(),
      step: z.number().finite().positive().optional(),
      accept: z.array(z.enum(["pdf", "docx", "jpg", "png"])).max(4).optional(),
      maxFiles: z.number().int().min(1).max(5).optional(),
      maxSizeMB: z.number().positive().max(10).optional(),
      logic: z.object({
        rules: z.array(z.object({
          answer: z.string().min(1).max(200),
          targetFieldId: z.string().min(1).max(64),
          operator: z.enum(["EQ", "GT", "LT", "GTE", "LTE"]).optional(),
          conditions: z.array(z.object({ operator: z.enum(["EQ", "GT", "LT", "GTE", "LTE"]), value: z.string().min(1).max(200) })).min(1).max(10).optional(),
          conditionJoin: z.enum(["AND", "OR"]).optional(),
        })).max(50),
      }).optional(),
    })
    .nullable()
    .optional(),
});

export const createFormFromTemplateInput = z.object({
  title: z.string().min(1).max(50),
  description: z.string().max(300).optional(),
  createdBy: z.uuid(),
  template: formTemplateEnum,
  submissionLayout: formSubmissionLayoutEnum,
  fields: z.array(templateFieldInput).max(60),
});

export type CreateFormFromTemplateInputType = z.infer<typeof createFormFromTemplateInput>;

export const listFormsByUserIdInput = z.object({
  userId: z.uuid().describe("UUID of the user"),
});

export type ListFormsByUserIdInputType = z.infer<typeof listFormsByUserIdInput>;

export const getFormWithFieldsInput = z.object({
  formId: z.uuid(),
  requesterId: z.uuid().optional().describe("Signed-in visitor, if any"),
  accessCode: z.string().max(12).optional().describe("Code entered by the visitor, if prompted"),
  live: z
    .boolean()
    .optional()
    .describe("Owner only: return the live draft (builder) instead of the published version"),
});

export type GetFormWithFieldsInputType = z.infer<typeof getFormWithFieldsInput>;

export const updateFormInput = z.object({
  formId: z.uuid().describe("UUID of the form to update"),
  userId: z.uuid().describe("UUID of the user making the request"),
  title: z.string().min(1).max(50).optional().describe("New title of the form"),
  description: z.string().max(300).nullable().optional().describe("New description of the form"),
  template: formTemplateEnum.optional().describe("Design template applied to the public page"),
  submissionLayout: formSubmissionLayoutEnum.optional(),
});

export type UpdateFormInputType = z.infer<typeof updateFormInput>;

// Publication settings. `autoClose`: undefined = leave the current schedule alone, null = no
// scheduled closure, { minutes } = close that many minutes from now (5 minutes .. 30 days).
export const publishFormInput = z.object({
  formId: z.uuid(),
  userId: z.uuid(),
  status: formStatusEnumSchema.describe("DRAFT, PUBLISHED or CLOSED"),
  accessMode: formAccessModeEnum,
  respondentIdentity: formRespondentIdentityEnumSchema,
  oneResponsePerEmail: z.boolean().default(false),
  autoClose: z
    .object({ minutes: z.number().int().min(5).max(30 * 24 * 60) })
    .nullable()
    .optional(),
});

export type PublishFormInputType = z.infer<typeof publishFormInput>;

export const deleteFormInput = z.object({
  formId: z.uuid().describe("UUID of the form to delete"),
  userId: z.uuid().describe("UUID of the user making the request"),
});

export type DeleteFormInputType = z.infer<typeof deleteFormInput>;

export const regenerateAccessCodeInput = z.object({
  formId: z.uuid(),
  userId: z.uuid(),
});

export type RegenerateAccessCodeInputType = z.infer<typeof regenerateAccessCodeInput>;
