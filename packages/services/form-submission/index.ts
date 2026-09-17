// packages/services/form-submission/index.ts

import { db, eq, and } from "@repo/database";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formFieldsTable } from "@repo/database/models/form-field";
import { createSubmissionInput, CreateSubmissionInputType } from "./model";

export default class FormSubmissionService {
  public async createSubmission(payload: CreateSubmissionInputType) {
    const { formId, values } = await createSubmissionInput.parseAsync(payload);

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

    const result = await db
      .insert(formSubmissionsTable)
      .values({ formId, values })
      .returning({ id: formSubmissionsTable.id, createdAt: formSubmissionsTable.createdAt });

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
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }));
  }
}
