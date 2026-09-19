import { db, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";

import {
  createFormInput,
  type CreateFormInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
  updateFormInput,
  type UpdateFormInputType,
  deleteFormInput,
  type DeleteFormInputType,
} from "./model";

/**
 * Shared ownership guard, used by every service that needs to confirm a
 * form belongs to the caller (form fields, submissions, and the form
 * service itself). A non-owner and a non-existent form get the same error
 * — deliberately not distinguishing the two so a probing request can't
 * learn whether a given formId exists.
 */
export async function assertFormOwnership(formId: string, userId: string) {
  const rows = await db
    .select({ id: formsTable.id, createdBy: formsTable.createdBy })
    .from(formsTable)
    .where(eq(formsTable.id, formId));

  const form = rows[0];
  if (!form || form.createdBy !== userId) {
    throw new Error("Form not found");
  }

  return form;
}

export default class FormService {
  public async createForm(payload: CreateFormInputType) {
    const { title, description, createdBy } = await createFormInput.parseAsync(payload);

    const result = await db
      .insert(formsTable)
      .values({
        title,
        description,
        createdBy,
      })
      .returning({
        id: formsTable.id,
      });

    if (!result || result.length === 0 || !result[0]?.id)
      throw new Error("Something went wrong while creating the form");

    return {
      id: result[0].id,
    };
  }

  public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
    const { userId } = await listFormsByUserIdInput.parseAsync(payload);

    const forms = await db
      .select({
        id: formsTable.id,
        title: formsTable.title,
        description: formsTable.description,
        status: formsTable.status,
        visibility: formsTable.visibility,
        theme: formsTable.theme,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,
      })
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId));

    return forms;
  }

  public async getFormWithFields(formId: string) {
    const rows = await db
      .select({
        id: formsTable.id,
        title: formsTable.title,
        description: formsTable.description,
        status: formsTable.status,
        visibility: formsTable.visibility,
        theme: formsTable.theme,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,

        field_id: formFieldsTable.id,
        field_formId: formFieldsTable.formId,
        field_label: formFieldsTable.label,
        field_labelKey: formFieldsTable.labelKey,
        field_description: formFieldsTable.description,
        field_placeholder: formFieldsTable.placeholder,
        field_isRequired: formFieldsTable.isRequired,
        field_config: formFieldsTable.config,
        field_index: formFieldsTable.index,
        field_type: formFieldsTable.type,
        field_createdAt: formFieldsTable.createdAt,
        field_updatedAt: formFieldsTable.updatedAt,
      })
      .from(formsTable)
      .leftJoin(formFieldsTable, eq(formFieldsTable.formId, formsTable.id))
      .where(eq(formsTable.id, formId))
      .orderBy(formFieldsTable.index);

    if (!rows || rows.length === 0) throw new Error(`Form with ID ${formId} not found`);

    const first = rows[0]!;

    const form = {
      id: first.id,
      title: first.title,
      description: first.description ?? null,
      status: first.status,
      visibility: first.visibility,
      theme: first.theme,
      createdAt: first.createdAt ? first.createdAt.toISOString() : null,
      updatedAt: first.updatedAt ? first.updatedAt.toISOString() : null,
      fields: [] as Array<any>,
    };

    for (const r of rows) {
      if (!r.field_id) continue;

      form.fields.push({
        id: r.field_id,
        formId: r.field_formId,
        label: r.field_label,
        labelKey: r.field_labelKey,
        description: r.field_description ?? null,
        placeholder: r.field_placeholder ?? null,
        isRequired: r.field_isRequired,
        config: r.field_config ?? null,
        index: r.field_index!.toString(),
        type: r.field_type,
        createdAt: r.field_createdAt ? r.field_createdAt.toISOString() : null,
        updatedAt: r.field_updatedAt ? r.field_updatedAt.toISOString() : null,
      });
    }

    return form;
  }

  public async updateForm(payload: UpdateFormInputType) {
    const { formId, userId, title, description, theme } = await updateFormInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    const updates: Partial<typeof formsTable.$inferInsert> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (theme !== undefined) updates.theme = theme;

    if (Object.keys(updates).length === 0) return { id: formId };

    await db.update(formsTable).set(updates).where(eq(formsTable.id, formId));

    return { id: formId };
  }

  public async deleteForm(payload: DeleteFormInputType) {
    const { formId, userId } = await deleteFormInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    // Fields and submissions cascade via the FK's onDelete: "cascade".
    await db.delete(formsTable).where(eq(formsTable.id, formId));

    return { id: formId };
  }
}
