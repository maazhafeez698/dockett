import { db, eq, max } from "@repo/database";
import { formFieldsTable } from "@repo/database/models/form-field";
import { assertFormOwnership } from "@repo/services/form";

import {
  createFieldInput,
  type CreateFieldInputType,
  getFieldsInput,
  type GetFieldsInputType,
  updateFieldInput,
  type UpdateFieldInputType,
  deleteFieldInput,
  type DeleteFieldInputType,
  reorderFieldsInput,
  type ReorderFieldsInputType,
  type FieldType,
  type FieldConfig,
} from "./model";

const OPTION_BASED_TYPES = new Set<FieldType>([
  "DROPDOWN",
  "MULTI_SELECT",
  "CHECKBOX_GROUP",
  "RADIO_GROUP",
]);

/**
 * The shape of `config` is validated loosely at the zod layer; which keys
 * are actually *required* depends on the field's type, which is what this
 * checks. Keeps the zod schema simple while still being strict per-type.
 */
function validateConfigForType(type: FieldType, config: FieldConfig | undefined | null) {
  if (OPTION_BASED_TYPES.has(type)) {
    if (!config?.options || config.options.length === 0) {
      throw new Error(`${formatTypeName(type)} fields need at least one option`);
    }
  }
  if (type === "NUMBER" && config) {
    const { minValue, maxValue } = config;
    if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
      throw new Error("Number fields: the minimum can't be greater than the maximum");
    }
  }
}

function formatTypeName(type: FieldType) {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function toLabelKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^ _|_$/g, "");
}

function mapField(r: typeof formFieldsTable.$inferSelect) {
  return {
    id: r.id,
    formId: r.formId,
    label: r.label,
    labelKey: r.labelKey,
    description: r.description ?? null,
    placeholder: r.placeholder ?? null,
    isRequired: r.isRequired,
    config: (r.config as FieldConfig) ?? null,
    index: r.index.toString(),
    type: r.type,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  };
}

export default class FormFieldService {
  private async getNextIndex(formId: string): Promise<string> {
    const result = await db
      .select({ maxIndex: max(formFieldsTable.index) })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));

    const current = result[0]?.maxIndex;
    const next = current ? Number(current) + 1 : 1;

    return next.toString();
  }

  private async getFieldOrThrow(fieldId: string) {
    const rows = await db.select().from(formFieldsTable).where(eq(formFieldsTable.id, fieldId));
    const field = rows[0];
    if (!field) throw new Error("Field not found");
    return field;
  }

  public async createField(payload: CreateFieldInputType) {
    const { label, type, formId, userId, description, placeholder, isRequired, config } =
      await createFieldInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);
    validateConfigForType(type, config);

    const labelKey = toLabelKey(label);
    const index = await this.getNextIndex(formId);

    const result = await db
      .insert(formFieldsTable)
      .values({
        label,
        labelKey,
        type,
        formId,
        description,
        placeholder,
        isRequired,
        config: config ?? null,
        index,
      })
      .returning({ id: formFieldsTable.id });

    if (!result || result.length === 0 || !result[0]?.id)
      throw new Error("Something went wrong while creating the field");

    return { id: result[0].id, labelKey, index };
  }

  public async getFields(payload: GetFieldsInputType) {
    const { formId, userId } = await getFieldsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    const result = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(formFieldsTable.index);

    return result.map(mapField);
  }

  public async updateField(payload: UpdateFieldInputType) {
    const { fieldId, userId, label, description, placeholder, isRequired, config } =
      await updateFieldInput.parseAsync(payload);

    const field = await this.getFieldOrThrow(fieldId);
    if (!field.formId) throw new Error("Field is not attached to a form");
    await assertFormOwnership(field.formId, userId);

    if (config !== undefined) {
      validateConfigForType(field.type as FieldType, config);
    }

    // labelKey is an immutable slug set at creation — editing the display
    // label does not regenerate it.
    const updates: Partial<typeof formFieldsTable.$inferInsert> = {};
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;
    if (placeholder !== undefined) updates.placeholder = placeholder;
    if (isRequired !== undefined) updates.isRequired = isRequired;
    if (config !== undefined) updates.config = config;

    if (Object.keys(updates).length > 0) {
      await db.update(formFieldsTable).set(updates).where(eq(formFieldsTable.id, fieldId));
    }

    return { id: fieldId };
  }

  public async deleteField(payload: DeleteFieldInputType) {
    const { fieldId, userId } = await deleteFieldInput.parseAsync(payload);

    const field = await this.getFieldOrThrow(fieldId);
    if (!field.formId) throw new Error("Field is not attached to a form");
    await assertFormOwnership(field.formId, userId);

    await db.delete(formFieldsTable).where(eq(formFieldsTable.id, fieldId));

    return { id: fieldId };
  }

  public async reorderFields(payload: ReorderFieldsInputType) {
    const { formId, userId, orderedFieldIds } = await reorderFieldsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    const existing = await db
      .select({ id: formFieldsTable.id })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));

    const existingIds = new Set(existing.map((f) => f.id));
    const requestedIds = new Set(orderedFieldIds);

    const sameSet =
      existingIds.size === requestedIds.size &&
      [...existingIds].every((id) => requestedIds.has(id));

    if (!sameSet) {
      throw new Error("The field list doesn't match this form's current fields");
    }

    await Promise.all(
      orderedFieldIds.map((fieldId, position) =>
        db
          .update(formFieldsTable)
          .set({ index: (position + 1).toString() })
          .where(eq(formFieldsTable.id, fieldId)),
      ),
    );

    return { success: true };
  }
}
