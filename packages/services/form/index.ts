import { db, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";

import {
  createFormInput,
  type CreateFormInputType,
  createFormFromTemplateInput,
  type CreateFormFromTemplateInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
  getFormWithFieldsInput,
  type GetFormWithFieldsInputType,
  updateFormInput,
  type UpdateFormInputType,
  deleteFormInput,
  type DeleteFormInputType,
  regenerateAccessCodeInput,
  type RegenerateAccessCodeInputType,
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

function toLabelKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Short, human-typeable code — unambiguous alphabet (no 0/O/1/I). */
function generateAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

const FORM_SELECT_COLUMNS = {
  id: formsTable.id,
  title: formsTable.title,
  description: formsTable.description,
  status: formsTable.status,
  visibility: formsTable.visibility,
  submissionAccess: formsTable.submissionAccess,
  template: formsTable.template,
  submissionLayout: formsTable.submissionLayout,
  accessCode: formsTable.accessCode,
  createdBy: formsTable.createdBy,
  createdAt: formsTable.createdAt,
  updatedAt: formsTable.updatedAt,
};

export default class FormService {
  public async createForm(payload: CreateFormInputType) {
    const { title, description, createdBy, template, submissionLayout } =
      await createFormInput.parseAsync(payload);

    const result = await db
      .insert(formsTable)
      .values({
        title,
        description,
        createdBy,
        ...(template ? { template } : {}),
        ...(submissionLayout ? { submissionLayout } : {}),
      })
      .returning({ id: formsTable.id });

    if (!result || result.length === 0 || !result[0]?.id)
      throw new Error("Something went wrong while creating the form");

    return { id: result[0].id };
  }

  /**
   * Creates a form and its fields from a gallery template in one call —
   * fields land in the given order (sequential inserts, same reasoning as
   * FormFieldService: index is derived from insertion order).
   */
  public async createFormFromTemplate(payload: CreateFormFromTemplateInputType) {
    const { title, description, createdBy, template, submissionLayout, fields } =
      await createFormFromTemplateInput.parseAsync(payload);

    const result = await db
      .insert(formsTable)
      .values({ title, description, createdBy, template, submissionLayout })
      .returning({ id: formsTable.id });

    const formId = result[0]?.id;
    if (!formId) throw new Error("Something went wrong while creating the form");

    let index = 1;
    for (const field of fields) {
      await db.insert(formFieldsTable).values({
        formId,
        label: field.label,
        labelKey: toLabelKey(field.label),
        type: field.type,
        description: field.description,
        placeholder: field.placeholder,
        isRequired: field.isRequired ?? false,
        config: field.config ?? null,
        index: String(index),
      });
      index += 1;
    }

    return { id: formId };
  }

  public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
    const { userId } = await listFormsByUserIdInput.parseAsync(payload);

    const forms = await db
      .select(FORM_SELECT_COLUMNS)
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId));

    // accessCode isn't secret from the owner (it's their own form's list).
    return forms;
  }

  /** Cheap, always-public metadata — used by the fill page to decide what
   * gate (if any) to show *before* attempting to load the actual fields. */
  public async getFormAccessInfo(formId: string) {
    const rows = await db
      .select(FORM_SELECT_COLUMNS)
      .from(formsTable)
      .where(eq(formsTable.id, formId));
    const form = rows[0];
    if (!form) throw new Error("Form not found");

    return {
      id: form.id,
      title: form.title,
      description: form.description ?? null,
      status: form.status,
      submissionAccess: form.submissionAccess,
      template: form.template,
    };
  }

  public async getFormWithFields(payload: GetFormWithFieldsInputType) {
    const { formId, requesterId, accessCode } = await getFormWithFieldsInput.parseAsync(payload);

    const rows = await db
      .select({
        ...FORM_SELECT_COLUMNS,
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

    if (!rows || rows.length === 0) throw new Error("Form not found");

    const first = rows[0]!;
    const isOwner = !!requesterId && requesterId === first.createdBy;

    if (!isOwner) {
      if (first.status !== "PUBLISHED") {
        // Same message as "doesn't exist" — a draft/closed form isn't
        // distinguishable from a nonexistent one to a non-owner.
        throw new Error("Form not found");
      }
      if (first.submissionAccess === "ACCESS_CODE") {
        if (!accessCode || accessCode.toUpperCase() !== (first.accessCode ?? "").toUpperCase()) {
          throw new Error("ACCESS_CODE_REQUIRED");
        }
      }
      if (first.submissionAccess === "AUTHENTICATED_ONLY" && !requesterId) {
        throw new Error("LOGIN_REQUIRED");
      }
    }

    const form = {
      id: first.id,
      title: first.title,
      description: first.description ?? null,
      status: first.status,
      visibility: first.visibility,
      submissionAccess: first.submissionAccess,
      template: first.template,
      submissionLayout: first.submissionLayout,
      // Only the owner ever sees the code itself — everyone else already
      // had to know it to get this far.
      accessCode: isOwner ? (first.accessCode ?? null) : null,
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
    const {
      formId,
      userId,
      title,
      description,
      template,
      submissionLayout,
      status,
      visibility,
      submissionAccess,
    } = await updateFormInput.parseAsync(payload);

    const existing = await assertFormOwnership(formId, userId);

    const updates: Partial<typeof formsTable.$inferInsert> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (template !== undefined) updates.template = template;
    if (submissionLayout !== undefined) updates.submissionLayout = submissionLayout;
    if (status !== undefined) updates.status = status;
    if (visibility !== undefined) updates.visibility = visibility;

    if (submissionAccess !== undefined) {
      updates.submissionAccess = submissionAccess;

      if (submissionAccess === "ACCESS_CODE") {
        // Generate one lazily, on first switch into this mode — never
        // silently rotate a code that's already been shared out.
        const current = await db
          .select({ accessCode: formsTable.accessCode })
          .from(formsTable)
          .where(eq(formsTable.id, formId));
        if (!current[0]?.accessCode) {
          updates.accessCode = generateAccessCode();
        }
      } else {
        updates.accessCode = null;
      }
    }

    if (Object.keys(updates).length === 0) return { id: formId };

    await db.update(formsTable).set(updates).where(eq(formsTable.id, formId));

    void existing;
    return { id: formId };
  }

  public async regenerateAccessCode(payload: RegenerateAccessCodeInputType) {
    const { formId, userId } = await regenerateAccessCodeInput.parseAsync(payload);
    await assertFormOwnership(formId, userId);

    const code = generateAccessCode();
    await db
      .update(formsTable)
      .set({ accessCode: code, submissionAccess: "ACCESS_CODE" })
      .where(eq(formsTable.id, formId));

    return { accessCode: code };
  }

  public async deleteForm(payload: DeleteFormInputType) {
    const { formId, userId } = await deleteFormInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    // Fields and submissions cascade via the FK's onDelete: "cascade".
    await db.delete(formsTable).where(eq(formsTable.id, formId));

    return { id: formId };
  }
}
