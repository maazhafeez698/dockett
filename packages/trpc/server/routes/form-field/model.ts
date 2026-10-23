import { z } from "zod";

export const fieldTypeEnum = z.enum([
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
]);

export const fieldConfigModel = z
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
  .optional();

export const createFieldInputModel = z.object({
  label: z.string().min(1).max(100).describe("Display label for the field"),
  type: fieldTypeEnum.describe("Type of the field"),
  formId: z.uuid().describe("UUID of the form this field belongs to"),
  description: z.string().max(1000).optional().describe("Helper text shown below the field"),
  placeholder: z.string().optional().describe("Placeholder text for the field"),
  isRequired: z.boolean().optional().default(false).describe("Whether the field is required"),
  config: fieldConfigModel.describe("Type-specific settings (options, max length, rating scale)"),
});

export const createFieldOutputModel = z.object({
  id: z.string().describe("ID of the created field"),
  labelKey: z.string().describe("Immutable slug key for the field label"),
  index: z.string().describe("Index string for ordering"),
});

export const getFieldsInputModel = z.object({
  formId: z.uuid().describe("UUID of the form to fetch the fields for"),
});

export const fieldOutputModel = z.object({
  id: z.string(),
  formId: z.uuid().nullable(),
  label: z.string(),
  labelKey: z.string(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  isRequired: z.boolean(),
  config: fieldConfigModel,
  index: z.string(),
  type: fieldTypeEnum,
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const getFieldsOutputModel = z.array(fieldOutputModel);

export const updateFieldInputModel = z.object({
  fieldId: z.uuid().describe("UUID of the field to update"),
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  placeholder: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
  config: fieldConfigModel,
});

export const updateFieldOutputModel = z.object({
  id: z.string(),
});

export const deleteFieldInputModel = z.object({
  fieldId: z.uuid().describe("UUID of the field to delete"),
});

export const deleteFieldOutputModel = z.object({
  id: z.string(),
});

export const reorderFieldsInputModel = z.object({
  formId: z.uuid().describe("UUID of the form whose fields are being reordered"),
  orderedFieldIds: z.array(z.uuid()).min(1).describe("Field IDs in their new order"),
});

export const reorderFieldsOutputModel = z.object({
  success: z.boolean(),
});

export type CreateFieldInputModelType = z.infer<typeof createFieldInputModel>;
export type CreateFieldOutputModelType = z.infer<typeof createFieldOutputModel>;
export type GetFieldsInputModelType = z.infer<typeof getFieldsInputModel>;
export type GetFieldsOutputModelType = z.infer<typeof getFieldsOutputModel>;
