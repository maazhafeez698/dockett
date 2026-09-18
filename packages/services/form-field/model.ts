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
]);

export type FieldType = z.infer<typeof fieldTypeEnum>;

// One loose config shape covering every type's settings; which keys matter
// depends on the field's type (validated in index.ts, not here — this is
// just the shape check).
export const fieldConfigSchema = z
  .object({
    options: z.array(z.string().min(1).max(200)).max(50).optional(),
    maxLength: z.number().int().positive().max(5000).optional(),
    max: z.number().int().min(2).max(10).optional(), // rating scale
  })
  .nullable()
  .optional();

export type FieldConfig = z.infer<typeof fieldConfigSchema>;

export const createFieldInput = z.object({
  label: z.string().min(1).max(100).describe("Display label for the field"),
  type: fieldTypeEnum.describe("Type of the field"),
  formId: z.uuid().describe("UUID of the form this field belongs to"),
  userId: z.uuid().describe("UUID of the user making the request"),
  description: z.string().max(1000).optional().describe("Helper text shown below the field"),
  placeholder: z.string().optional().describe("Placeholder text for the field"),
  isRequired: z.boolean().optional().default(false).describe("Whether the field is required"),
  config: fieldConfigSchema.describe("Type-specific settings (options, max length, rating scale)"),
});

export type CreateFieldInputType = z.infer<typeof createFieldInput>;

export const getFieldsInput = z.object({
  formId: z.uuid().describe("UUID of the form to fetch the fields for"),
  userId: z.uuid().describe("UUID of the user making the request"),
});

export type GetFieldsInputType = z.infer<typeof getFieldsInput>;

export const updateFieldInput = z.object({
  fieldId: z.uuid().describe("UUID of the field to update"),
  userId: z.uuid().describe("UUID of the user making the request"),
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  placeholder: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
  config: fieldConfigSchema,
});

export type UpdateFieldInputType = z.infer<typeof updateFieldInput>;

export const deleteFieldInput = z.object({
  fieldId: z.uuid().describe("UUID of the field to delete"),
  userId: z.uuid().describe("UUID of the user making the request"),
});

export type DeleteFieldInputType = z.infer<typeof deleteFieldInput>;

export const reorderFieldsInput = z.object({
  formId: z.uuid().describe("UUID of the form whose fields are being reordered"),
  userId: z.uuid().describe("UUID of the user making the request"),
  orderedFieldIds: z.array(z.uuid()).min(1).describe("Field IDs in their new order"),
});

export type ReorderFieldsInputType = z.infer<typeof reorderFieldsInput>;
