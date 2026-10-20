import { z } from "zod";
import { MAX_FIELDS_PER_FORM } from "@repo/services/form-field/limits";
import { fieldOutputModel } from "../form-field/model";

export const formStatusEnum = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);
export const formVisibilityEnum = z.enum(["PUBLIC", "UNLISTED"]);
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
export const formSubmissionAccessEnum = z.enum(["ANYONE", "ACCESS_CODE", "AUTHENTICATED_ONLY"]);

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
      accept: z
        .array(z.enum(["pdf", "docx", "jpg", "png"]))
        .max(4)
        .optional(),
      maxFiles: z.number().int().min(1).max(5).optional(),
      maxSizeMB: z.number().positive().max(10).optional(),
    })
    .nullable()
    .optional(),
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
  fields: z.array(templateFieldModel).max(MAX_FIELDS_PER_FORM),
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
    visibility: formVisibilityEnum,
    submissionAccess: formSubmissionAccessEnum,
    template: formTemplateEnum,
    submissionLayout: formSubmissionLayoutEnum,
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
});

export const getFormOutputModel = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: formStatusEnum,
  visibility: formVisibilityEnum,
  submissionAccess: formSubmissionAccessEnum,
  template: formTemplateEnum,
  submissionLayout: formSubmissionLayoutEnum,
  accessCode: z.string().nullable(),
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
  submissionAccess: formSubmissionAccessEnum,
  template: formTemplateEnum,
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
  status: formStatusEnum.optional(),
  visibility: formVisibilityEnum.optional(),
  submissionAccess: formSubmissionAccessEnum.optional(),
});

export const updateFormOutputModel = z.object({
  id: z.string(),
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
