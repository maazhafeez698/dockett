import { z } from "zod";
import { fieldOutputModel } from "../form-field/model";

export const formStatusEnum = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);
export const formRespondentIdentityEnum = z.enum(["ANONYMOUS", "VERIFIED_EMAIL"]);
export const formAccessModeEnum = z.enum(["ANYONE", "ACCESS_CODE"]);
export const formClosedReasonEnum = z.enum(["MANUAL", "SCHEDULED", "INACTIVE"]);
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
// The API only ever returns ANYONE | ACCESS_CODE (the old sign-in-only mode is treated as ANYONE).
export const formSubmissionAccessEnum = formAccessModeEnum;

const templateFieldModel = z.object({
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

const designSettingsModel = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  surfaceMode: z.enum(["LIGHT", "DARK"]).optional(),
  typography: z.enum(["SANS", "SERIF", "MONO"]).optional(),
  corners: z.enum(["SOFT", "SHARP"]).optional(),
});

export const createFormInputModel = z.object({
  title: z.string().max(55).describe("Title of the form"),
  description: z.string().max(300).optional().describe("Description of the form"),
  template: formTemplateEnum.optional(),
  submissionLayout: formSubmissionLayoutEnum.optional(),
});

export const createFormOutputModel = z.object({
  id: z.string().describe("ID of the created form"),
});

export const createFormFromTemplateInputModel = z.object({
  title: z.string().min(1).max(50),
  description: z.string().max(300).optional(),
  template: formTemplateEnum,
  submissionLayout: formSubmissionLayoutEnum,
  fields: z.array(templateFieldModel).max(60),
});

export const createFormFromTemplateOutputModel = z.object({
  id: z.string(),
});

export const listFormsInputModel = z.undefined();
export const listFormsOutputModel = z.array(
  z.object({
    id: z.string().describe("ID of the form"),
    title: z.string().describe("Title of the form"),
    description: z.string().nullable().optional().describe("Description of the form"),
    status: formStatusEnum,
    closedReason: formClosedReasonEnum.nullable().optional(),
    submissionAccess: formSubmissionAccessEnum,
    respondentIdentity: formRespondentIdentityEnum,
    oneResponsePerEmail: z.boolean(),
    closesAt: z.date().nullable().optional(),
    template: formTemplateEnum,
    submissionLayout: formSubmissionLayoutEnum,
    designSettings: designSettingsModel,
    accessCode: z.string().nullable().optional(),
    planSuspended: z
      .boolean()
      .optional()
      .describe("True when the plan's active-form limit no longer covers this published form"),

    createdAt: z.date().nullable().describe("Creation timestamp"),
    updatedAt: z.date().nullable().describe("Last updated timestamp"),
  }),
);

export const getFormInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to fetch"),
  accessCode: z.string().max(12).optional().describe("Code entered by the visitor, if prompted"),
  live: z
    .boolean()
    .optional()
    .describe("Owner only: return the live draft (builder) instead of the published version"),
});

export const getFormOutputModel = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: formStatusEnum,
  closedReason: formClosedReasonEnum.nullable(),
  submissionAccess: formSubmissionAccessEnum,
  respondentIdentity: formRespondentIdentityEnum,
  oneResponsePerEmail: z.boolean(),
  template: formTemplateEnum,
  submissionLayout: formSubmissionLayoutEnum,
  designSettings: designSettingsModel,
  accessCode: z.string().nullable(),
  versionId: z.string().nullable().describe("The published version this content belongs to (null for a live draft)"),
  version: z.number().nullable().describe("Version number of the current publication"),
  hasUnpublishedChanges: z.boolean().describe("Owner only: the draft differs from the published version"),
  closesAt: z.string().nullable().describe("Owner only: scheduled automatic closure"),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  fields: z.array(fieldOutputModel),
});

export const getFormAccessInfoInputModel = z.object({
  formId: z.uuid(),
});

export const getFormAccessInfoOutputModel = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: formStatusEnum,
  closedReason: formClosedReasonEnum.nullable(),
  submissionAccess: formSubmissionAccessEnum,
  respondentIdentity: formRespondentIdentityEnum,
  oneResponsePerEmail: z.boolean(),
  template: formTemplateEnum,
  designSettings: designSettingsModel,
  planUnavailable: z
    .boolean()
    .optional()
    .describe("True when the owner's plan no longer covers this form (it is suspended)"),
  responseLimitReached: z
    .boolean()
    .optional()
    .describe("True when the form has used up its monthly response quota"),
});

export const updateFormInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to update"),
  title: z.string().min(1).max(50).optional(),
  description: z.string().max(300).nullable().optional(),
  template: formTemplateEnum.optional(),
  submissionLayout: formSubmissionLayoutEnum.optional(),
  designSettings: designSettingsModel.optional(),
});

export const updateFormOutputModel = z.object({
  id: z.string(),
});

// Publishing: status, access, respondent identity and automatic closure in one atomic call.
export const publishFormInputModel = z.object({
  formId: z.uuid(),
  status: formStatusEnum,
  accessMode: formAccessModeEnum,
  respondentIdentity: formRespondentIdentityEnum,
  oneResponsePerEmail: z.boolean().default(false),
  autoClose: z
    .object({ minutes: z.number().int().min(5).max(30 * 24 * 60) })
    .nullable()
    .optional()
    .describe("undefined = keep the current schedule, null = never, { minutes } = close that long from now (max 30 days)"),
});

export const publishFormOutputModel = z.object({
  id: z.string(),
  status: formStatusEnum,
  version: z.number().nullable().describe("The live version number (null unless published)"),
  versionId: z.string().nullable(),
  createdVersion: z.boolean().describe("True when this publication created a new version"),
  closesAt: z.string().nullable().describe("Exact scheduled closing time (server clock), if any"),
  accessCode: z.string().nullable(),
  submissionAccess: formAccessModeEnum,
  respondentIdentity: formRespondentIdentityEnum,
  oneResponsePerEmail: z.boolean(),
});

export const deleteFormInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to delete"),
});

export const deleteFormOutputModel = z.object({
  id: z.string(),
});

export const regenerateAccessCodeInputModel = z.object({
  formId: z.uuid(),
});

export const regenerateAccessCodeOutputModel = z.object({
  accessCode: z.string(),
});
