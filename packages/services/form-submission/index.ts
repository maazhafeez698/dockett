// packages/services/form-submission/index.ts

import { db, eq, and } from "@repo/database";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formsTable } from "@repo/database/models/form";
import { PlanLimitError, isFormSuspended, withResponseQuota } from "@repo/services/billing";
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

    const submittedById = new Map(values.map((v) => [v.fieldId, v.value]));

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
        .values({ formId, values, submittedBy: requesterId ?? null })
        .returning({ id: formSubmissionsTable.id, createdAt: formSubmissionsTable.createdAt });

    const result = isLive
      ? await withResponseQuota(form.id, form.createdBy, (tx) => insertRow(tx))
      : await insertRow(db);

    if (!result || result.length === 0 || !result[0]?.id)
      throw new Error("Something went wrong while creating the submission");

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
