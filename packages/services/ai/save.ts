import { db, eq, max, count } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { assertFormOwnership } from "@repo/services/form";
import { effectiveTemplate, getUserPlan } from "@repo/services/billing";
import { MAX_FIELDS_PER_FORM } from "../form-field/limits";

import { AiError } from "./errors";
import {
  assertDraftConsistent,
  dedupeLabels,
  formDraftSchema,
  toLabelKey,
  type DraftField,
  type FormDraft,
} from "./draft";

function fieldRow(formId: string, f: DraftField, position: number) {
  return {
    formId,
    label: f.label,
    labelKey: toLabelKey(f.label) || `field_${position}`,
    type: f.type,
    description: f.description ?? null,
    placeholder: f.placeholder ?? null,
    isRequired: f.isRequired ?? false,
    config: f.config ?? null,
    index: String(position),
  };
}

export async function saveDraftAsForm(userId: string, rawDraft: unknown): Promise<{ id: string }> {
  const parsed = formDraftSchema.safeParse(rawDraft);
  if (!parsed.success) {
    throw new AiError("INVALID_REQUEST", "Invalid draft", {
      userMessage: parsed.error.issues[0]?.message,
    });
  }
  // Plan gate: a premium template the user's plan doesn't include is replaced by the plain default.
  const plan = await getUserPlan(userId);
  const draft: FormDraft = {
    ...parsed.data,
    template: effectiveTemplate(plan.features, parsed.data.template) as FormDraft["template"],
  };
  try {
    assertDraftConsistent(draft, MAX_FIELDS_PER_FORM);
  } catch (e) {
    throw new AiError("INVALID_REQUEST", "Inconsistent draft", {
      userMessage: e instanceof Error ? e.message : undefined,
    });
  }
  const fields = dedupeLabels(draft.fields);

  return db.transaction(async (tx) => {
    const created = await tx
      .insert(formsTable)
      .values({
        title: draft.title,
        description: draft.description ?? null,
        createdBy: userId,
        template: draft.template,
        submissionLayout: draft.submissionLayout,
      })
      .returning({ id: formsTable.id });
    const formId = created[0]?.id;
    if (!formId) throw new AiError("INTERNAL", "Form insert returned no id");

    await tx.insert(formFieldsTable).values(fields.map((f, i) => fieldRow(formId, f, i + 1)));
    return { id: formId };
  });
}

export async function applyDraftToForm(
  userId: string,
  formId: string,
  rawDraft: unknown,
): Promise<{ added: number; appliedSettings: boolean }> {
  const parsed = formDraftSchema.safeParse(rawDraft);
  if (!parsed.success) {
    throw new AiError("INVALID_REQUEST", "Invalid draft", {
      userMessage: parsed.error.issues[0]?.message,
    });
  }
  const plan = await getUserPlan(userId);
  const draft: FormDraft = {
    ...parsed.data,
    template: effectiveTemplate(plan.features, parsed.data.template) as FormDraft["template"],
  };
  try {
    assertDraftConsistent(draft, MAX_FIELDS_PER_FORM);
    await assertFormOwnership(formId, userId);
  } catch (e) {
    if (e instanceof Error && e.message === "Form not found") throw new AiError("FORM_NOT_FOUND");
    throw new AiError("INVALID_REQUEST", "Inconsistent draft", {
      userMessage: e instanceof Error ? e.message : undefined,
    });
  }

  return db.transaction(async (tx) => {
    const forms = await tx
      .select({ title: formsTable.title })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .for("update");
    const countRows = await tx
      .select({ fieldCount: count() })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    const fieldCount = countRows[0]?.fieldCount;
    if (fieldCount === undefined)
      throw new AiError("INTERNAL", "Failed to check the form's field count");

    const existing = await tx
      .select({ labelKey: formFieldsTable.labelKey })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    const fields = dedupeLabels(
      draft.fields,
      existing.map((e) => e.labelKey),
    );
    if (fieldCount + fields.length > MAX_FIELDS_PER_FORM) {
      throw new AiError("INVALID_REQUEST", "Too many fields", {
        userMessage: `A form can have at most ${MAX_FIELDS_PER_FORM} fields.`,
      });
    }

    const emptyCanvas = existing.length === 0;
    if (emptyCanvas) {
      const keepTitle = forms[0]?.title && !/^untitled/i.test(forms[0].title);
      await tx
        .update(formsTable)
        .set({
          ...(keepTitle ? {} : { title: draft.title }),
          description: draft.description ?? null,
          template: draft.template,
          submissionLayout: draft.submissionLayout,
        })
        .where(eq(formsTable.id, formId));
    }

    const top = await tx
      .select({ maxIndex: max(formFieldsTable.index) })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    const start = top[0]?.maxIndex ? Number(top[0].maxIndex) : 0;

    await tx
      .insert(formFieldsTable)
      .values(fields.map((f, i) => fieldRow(formId, f, start + i + 1)));
    return { added: fields.length, appliedSettings: emptyCanvas };
  });
}
