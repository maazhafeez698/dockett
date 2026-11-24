import { and, db, eq, isNull } from "@repo/database";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formsTable } from "@repo/database/models/form";
import { formVersionsTable } from "@repo/database/models/form-version";
import { buildSnapshot, hashSnapshot } from "./publication";

export async function ensurePublishedVersion(formId: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const form = (
      await tx
        .select({
          id: formsTable.id,
          status: formsTable.status,
          title: formsTable.title,
          description: formsTable.description,
          template: formsTable.template,
          submissionLayout: formsTable.submissionLayout,
          designSettings: formsTable.designSettings,
          publishedVersionId: formsTable.publishedVersionId,
        })
        .from(formsTable)
        .where(eq(formsTable.id, formId))
        .for("update")
    )[0];
    if (!form) return null;
    if (form.publishedVersionId) return form.publishedVersionId;
    if (form.status !== "PUBLISHED") return null;

    const fields = await tx
      .select({
        id: formFieldsTable.id,
        formId: formFieldsTable.formId,
        label: formFieldsTable.label,
        labelKey: formFieldsTable.labelKey,
        description: formFieldsTable.description,
        placeholder: formFieldsTable.placeholder,
        isRequired: formFieldsTable.isRequired,
        config: formFieldsTable.config,
        index: formFieldsTable.index,
        type: formFieldsTable.type,
        createdAt: formFieldsTable.createdAt,
        updatedAt: formFieldsTable.updatedAt,
      })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(formFieldsTable.index);

    const snapshot = buildSnapshot(
      { title: form.title, description: form.description ?? null, template: form.template, submissionLayout: form.submissionLayout, designSettings: form.designSettings },
      fields,
    );
    const inserted = await tx
      .insert(formVersionsTable)
      .values({ formId, version: 1, contentHash: hashSnapshot(snapshot), snapshot })
      .returning({ id: formVersionsTable.id });
    const versionId = inserted[0]!.id;
    await tx.update(formsTable).set({ publishedVersionId: versionId }).where(eq(formsTable.id, formId));
    return versionId;
  });
}

/** Startup / sweep: give every legacy published form its version 1. */
export async function backfillPublishedVersions(limit = 200): Promise<number> {
  const rows = await db
    .select({ id: formsTable.id })
    .from(formsTable)
    .where(and(eq(formsTable.status, "PUBLISHED"), isNull(formsTable.publishedVersionId)))
    .limit(limit);
  let n = 0;
  for (const r of rows) {
    if (await ensurePublishedVersion(r.id)) n++;
  }
  return n;
}
