import { db, eq, max } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { assertFormOwnership } from "@repo/services/form";
import { effectiveTemplate, getUserPlan } from "@repo/services/billing";

import { AiError } from "./errors";
import {
  assertDraftConsistent,
  dedupeLabels,
  formDraftSchema,
  toLabelKey,
  type DraftField,
  type FormDraft,
} from "./draft";

/** Same ceiling the draft schema uses; a form can never exceed it however it was built. */
export const HARD_MAX_FIELDS = 100;

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

/**
 * Persists an approved draft as a brand-new form owned by `userId`.
 * The draft is re-validated here: it came through the browser, so it is
 * untrusted no matter who originally produced it. One transaction —
 * a form is never left half-populated.
 */
export async function saveDraftAsForm(userId: string, rawDraft: unknown): Promise<{ id: string }> {
  const parsed = formDraftSchema.safeParse(rawDraft);
  if (!parsed.success) {
    throw new AiError("INVALID_REQUEST", "Invalid draft", { userMessage: parsed.error.issues[0]?.message });
  }
  // Plan gate: a premium template the user's plan doesn't include is replaced by the plain default.
  const plan = await getUserPlan(userId);
  const draft: FormDraft = {
    ...parsed.data,
    template: effectiveTemplate(plan.features, parsed.data.template) as FormDraft["template"],
  };
  try {
    assertDraftConsistent(draft, HARD_MAX_FIELDS);
  } catch (e) {
    throw new AiError("INVALID_REQUEST", "Inconsistent draft", { userMessage: e instanceof Error ? e.message : undefined });
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

/**
 * Applies an approved draft to a form the user already has open on the canvas.
 *  - Empty canvas  → the draft IS the form: description, template and layout are applied too
 *    (and the title, unless the user already renamed it from "Untitled…").
 *  - Canvas has fields → the draft's fields are appended to the end; nothing else is touched.
 * One transaction, ownership-checked, and the draft is re-validated (it came through the browser).
 */
export async function applyDraftToForm(
  userId: string,
  formId: string,
  rawDraft: unknown,
): Promise<{ added: number; appliedSettings: boolean }> {
  const parsed = formDraftSchema.safeParse(rawDraft);
  if (!parsed.success) {
    throw new AiError("INVALID_REQUEST", "Invalid draft", { userMessage: parsed.error.issues[0]?.message });
  }
  const plan = await getUserPlan(userId);
  const draft: FormDraft = {
    ...parsed.data,
    template: effectiveTemplate(plan.features, parsed.data.template) as FormDraft["template"],
  };
  try {
    assertDraftConsistent(draft, HARD_MAX_FIELDS);
    await assertFormOwnership(formId, userId);
  } catch (e) {
    if (e instanceof Error && e.message === "Form not found") throw new AiError("FORM_NOT_FOUND");
    throw new AiError("INVALID_REQUEST", "Inconsistent draft", { userMessage: e instanceof Error ? e.message : undefined });
  }

  return db.transaction(async (tx) => {
    const forms = await tx.select({ title: formsTable.title }).from(formsTable).where(eq(formsTable.id, formId));
    const existing = await tx
      .select({ labelKey: formFieldsTable.labelKey })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));

    if (existing.length + draft.fields.length > HARD_MAX_FIELDS) {
      throw new AiError("INVALID_REQUEST", "Too many fields", {
        userMessage: `A form can have at most ${HARD_MAX_FIELDS} fields.`,
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

    const fields = dedupeLabels(draft.fields, existing.map((e) => e.labelKey));
    const top = await tx
      .select({ maxIndex: max(formFieldsTable.index) })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    const start = top[0]?.maxIndex ? Number(top[0].maxIndex) : 0;

    await tx.insert(formFieldsTable).values(fields.map((f, i) => fieldRow(formId, f, start + i + 1)));
    return { added: fields.length, appliedSettings: emptyCanvas };
  });
}
