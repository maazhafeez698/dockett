import { z } from "zod";
import { fieldOutputModel } from "../form-field/model";

export const formStatusEnum = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);
export const formVisibilityEnum = z.enum(["PUBLIC", "UNLISTED"]);
export const formThemeEnum = z.enum(["MIDNIGHT", "CORAL", "MINT", "LAVENDER", "OCEAN"]);
export const formSubmissionAccessEnum = z.enum(["ANYONE", "AUTHENTICATED_ONLY", "ANONYMOUS_ONLY"]);

export const createFormInputModel = z.object({
  title: z.string().max(55).describe("Title of the form"),
  description: z.string().max(300).optional().describe("Description of the form"),
});

export const createFormOutputModel = z.object({
  id: z.string().describe("ID of the created form"),
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
    theme: formThemeEnum,

    createdAt: z.date().nullable().describe("Creation timestamp"),
    updatedAt: z.date().nullable().describe("Last updated timestamp"),
  }),
);

export const getFormInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to fetch"),
});

export const getFormOutputModel = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: formStatusEnum,
  visibility: formVisibilityEnum,
  submissionAccess: formSubmissionAccessEnum,
  theme: formThemeEnum,
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  fields: z.array(fieldOutputModel),
});

export const updateFormInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to update"),
  title: z.string().min(1).max(50).optional(),
  description: z.string().max(300).nullable().optional(),
  theme: formThemeEnum.optional(),
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
