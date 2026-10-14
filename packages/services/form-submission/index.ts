// packages/services/form-submission/index.ts

import { db, eq, and } from "@repo/database";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formsTable } from "@repo/database/models/form";
import { PlanLimitError, isFormSuspended, withResponseQuota } from "@repo/services/billing";
import {
  attachSubmissionFiles,
  prepareSubmissionFiles,
  type StoredFileRef,
} from "@repo/services/file-upload";
import { numberProblem } from "./number-rules";
import { createSubmissionInput, CreateSubmissionInputType } from "./model";

export default class FormSubmissionService {
  public async createSubmission(payload: CreateSubmissionInputType) {
    const { formId, values, requesterId, accessCode } =
      await createSubmissionInput.parseAsync(payload);

    const formRows = await db
      .select({
        id: formsTable.id,
        status: formsTable.status,
        submissionAccess: formsTable.submissionAccess,
        accessCode: formsTable.accessCode,
        createdBy: formsTable.createdBy,
      })
      .from(formsTable)
      .where(eq(formsTable.id, formId));

    const form = formRows[0];
    if (!form) throw new Error("Form not found");

    const isOwner = !!requesterId && requesterId === form.createdBy;

    // Owners can test-submit their own draft; everyone else needs it live.
    if (!isOwner && form.status !== "PUBLISHED") {
      throw new Error("This form isn't accepting responses right now");
    }

    if (!isOwner && form.submissionAccess === "ACCESS_CODE") {
      if (!accessCode || accessCode.toUpperCase() !== (form.accessCode ?? "").toUpperCase()) {
        throw new Error("A valid access code is required to submit this form");
      }
    }

    if (!isOwner && form.submissionAccess === "AUTHENTICATED_ONLY" && !requesterId) {
      throw new Error("Sign in to submit this form");
    }

    // Plan gates for live forms: a suspended form (owner downgraded past their active-form limit)
    // takes no responses, and the monthly response quota is enforced atomically at insert time.
    const isLive = form.status === "PUBLISHED";
    if (isLive && (await isFormSuspended(form.id, form.createdBy))) {
      throw new PlanLimitError("FORM_UNAVAILABLE", "This form is temporarily unavailable.");
    }

    const requiredFields = await db
      .select({ id: formFieldsTable.id, label: formFieldsTable.label })
      .from(formFieldsTable)
      .where(and(eq(formFieldsTable.formId, formId), eq(formFieldsTable.isRequired, true)));

    // FILE_UPLOAD answers arrive as upload ids. Resolve them against the verified uploads that were
    // issued for this form + field, and store the file references (not raw client input) instead.
    const fileFields = await db
      .select({
        id: formFieldsTable.id,
        label: formFieldsTable.label,
        config: formFieldsTable.config,
      })
      .from(formFieldsTable)
      .where(and(eq(formFieldsTable.formId, formId), eq(formFieldsTable.type, "FILE_UPLOAD")));

    let storedValues = values;
    const uploadIdsToAttach: string[] = [];
    if (fileFields.length > 0) {
      const byField = new Map(values.map((v) => [v.fieldId, v.value]));
      const replaced = new Map<string, string>();
      for (const field of fileFields) {
        const raw = byField.get(field.id);
        if (raw === undefined) continue;
        const { ids, refs } = await prepareSubmissionFiles(formId, field, raw);
        uploadIdsToAttach.push(...ids);
        replaced.set(field.id, refs.length > 0 ? JSON.stringify(refs satisfies StoredFileRef[]) : "");
      }
      storedValues = values.map((v) =>
        replaced.has(v.fieldId) ? { fieldId: v.fieldId, value: replaced.get(v.fieldId)! } : v,
      );
    }

    // NUMBER fields: enforce min / max / step on the server too (the browser's check is advisory).
    const numberFields = await db
      .select({ id: formFieldsTable.id, label: formFieldsTable.label, config: formFieldsTable.config })
      .from(formFieldsTable)
      .where(and(eq(formFieldsTable.formId, formId), eq(formFieldsTable.type, "NUMBER")));
    for (const nf of numberFields) {
      const given = storedValues.find((v) => v.fieldId === nf.id)?.value ?? "";
      const problem = numberProblem(given, (nf.config ?? {}) as { minValue?: number; maxValue?: number; step?: number });
      if (problem) throw new Error(`"${nf.label}": ${problem}`);
    }

    const submittedById = new Map(storedValues.map((v) => [v.fieldId, v.value]));

    const missing = requiredFields.filter((field) => {
      const value = submittedById.get(field.id);
      return value === undefined || value.trim().length === 0;
    });

    if (missing.length > 0) {
      const names = missing.map((f) => f.label).join(", ");
      throw new Error(
        missing.length === 1 ? `"${names}" is required` : `These fields are required: ${names}`,
      );
    }

    const insertRow = async (exec: Pick<typeof db, "insert">) =>
      await exec
        .insert(formSubmissionsTable)
        .values({ formId, values: storedValues, submittedBy: requesterId ?? null })
        .returning({ id: formSubmissionsTable.id, createdAt: formSubmissionsTable.createdAt });

    const result = isLive
      ? await withResponseQuota(form.id, form.createdBy, (tx) => insertRow(tx))
      : await insertRow(db);

    if (!result || result.length === 0 || !result[0]?.id)
      throw new Error("Something went wrong while creating the submission");

    if (uploadIdsToAttach.length > 0) {
      const attached = await attachSubmissionFiles(result[0].id, formId, uploadIdsToAttach);
      if (!attached) {
        // Someone used the same upload ids concurrently (a double submit). Undo this submission.
        await db.delete(formSubmissionsTable).where(eq(formSubmissionsTable.id, result[0].id));
        throw new Error("Those files were already submitted. Please upload them again.");
      }
    }

    return {
      id: result[0].id,
      createdAt: result[0].createdAt ? result[0].createdAt.toISOString() : null,
    };
  }

  public async getSubmissionsByFormId(formId: string) {
    const rows = await db
      .select({
        id: formSubmissionsTable.id,
        formId: formSubmissionsTable.formId,
        values: formSubmissionsTable.values,
        submittedBy: formSubmissionsTable.submittedBy,
        createdAt: formSubmissionsTable.createdAt,
        updatedAt: formSubmissionsTable.updatedAt,
      })
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, formId))
      .orderBy(formSubmissionsTable.createdAt);

    return rows.map((r) => ({
      id: r.id,
      formId: r.formId,
      values: r.values ?? [],
      submittedBy: r.submittedBy ?? null,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }));
  }
}
