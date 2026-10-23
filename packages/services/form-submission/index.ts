// packages/services/form-submission/index.ts
//
// Accepting a response. Everything is decided on the server, against the form's CURRENT
// PUBLICATION: the form must be live right now (status + scheduled closure + idle closure),
// access / respondent-identity rules must pass, and the answers are validated against the exact
// published version — whose id is stored with the response.
//
// Retries are safe: a client-generated idempotency key maps a repeated request to the response it
// already created, and the one-response-per-email rule is enforced by a unique index (so two
// simultaneous requests can't both win).

import { db, eq, and } from "@repo/database";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formsTable } from "@repo/database/models/form";
import { formVersionsTable } from "@repo/database/models/form-version";
import { PlanLimitError, isFormSuspended, withResponseQuota } from "@repo/services/billing";
import {
  attachSubmissionFiles,
  prepareSubmissionFiles,
  type StoredFileRef,
} from "@repo/services/file-upload";
import { verifyRespondentToken } from "@repo/services/form-respondent";
import { effectiveState } from "../form/publication";
import { ensurePublishedVersion } from "../form/ensure-version";
import { validateAnswers } from "./validate";
import { createSubmissionInput, CreateSubmissionInputType } from "./model";

/** Is this a Postgres unique-violation (drizzle may wrap the driver error in `cause`)? */
function uniqueViolation(error: unknown): string | null {
  const e = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } } | null;
  const pg = e?.cause?.code === "23505" ? e.cause : e?.code === "23505" ? e : null;
  return pg ? (pg.constraint ?? "unique") : null;
}

export default class FormSubmissionService {
  public async createSubmission(payload: CreateSubmissionInputType) {
    const { formId, values, requesterId, accessCode, respondentToken, idempotencyKey } =
      await createSubmissionInput.parseAsync(payload);

    const form = (
      await db
        .select({
          id: formsTable.id,
          status: formsTable.status,
          submissionAccess: formsTable.submissionAccess,
          accessCode: formsTable.accessCode,
          respondentIdentity: formsTable.respondentIdentity,
          oneResponsePerEmail: formsTable.oneResponsePerEmail,
          publishedVersionId: formsTable.publishedVersionId,
          closesAt: formsTable.closesAt,
          lastActivityAt: formsTable.lastActivityAt,
          closedReason: formsTable.closedReason,
          createdBy: formsTable.createdBy,
        })
        .from(formsTable)
        .where(eq(formsTable.id, formId))
    )[0];
    if (!form) throw new Error("Form not found");

    const isOwner = !!requesterId && requesterId === form.createdBy;

    // ---- is the form live RIGHT NOW? (server clock, not a browser timer) ----
    const eff = effectiveState(form);
    if (eff.status !== "PUBLISHED") {
      throw new Error(
        eff.status === "CLOSED"
          ? "This form is closed and no longer accepts responses."
          : "This form isn't accepting responses right now.",
      );
    }
    if (await isFormSuspended(form.id, form.createdBy)) {
      throw new PlanLimitError("FORM_UNAVAILABLE", "This form is temporarily unavailable.");
    }

    // ---- who may submit ----
    if (!isOwner && form.submissionAccess === "ACCESS_CODE") {
      if (!accessCode || accessCode.toUpperCase() !== (form.accessCode ?? "").toUpperCase()) {
        throw new Error("A valid access code is required to submit this form.");
      }
    }
    let verifiedEmail: string | null = null;
    if (form.respondentIdentity === "VERIFIED_EMAIL") {
      const claims = verifyRespondentToken(respondentToken, form.id);
      if (!claims) throw new Error("Please verify your email address to submit this form.");
      verifiedEmail = claims.email;
    }

    // ---- retry of a request that already succeeded: return the original response ----
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(form.id, idempotencyKey);
      if (existing) return existing;
    }

    // ---- the exact published version ----
    // (a form published before versioning existed gets its version 1 on first use)
    if (!form.publishedVersionId) form.publishedVersionId = await ensurePublishedVersion(form.id);
    if (!form.publishedVersionId) throw new Error("This form hasn't been published.");
    const version = (
      await db
        .select({ id: formVersionsTable.id, snapshot: formVersionsTable.snapshot })
        .from(formVersionsTable)
        .where(eq(formVersionsTable.id, form.publishedVersionId))
    )[0];
    if (!version) throw new Error("This form hasn't been published.");
    const fields = version.snapshot.fields;

    // ---- validate every answer against that version ----
    const answers = validateAnswers(fields, values);

    // FILE_UPLOAD answers arrive as upload ids: resolve them to verified uploads issued for this
    // form + field, and store the file references (never raw client input).
    const uploadIdsToAttach: string[] = [];
    for (const field of fields) {
      if (field.type !== "FILE_UPLOAD") continue;
      const { ids, refs } = await prepareSubmissionFiles(form.id, field, answers.get(field.id) ?? "");
      if (field.isRequired && ids.length === 0) throw new Error(`"${field.label}" is required`);
      uploadIdsToAttach.push(...ids);
      answers.set(field.id, refs.length > 0 ? JSON.stringify(refs satisfies StoredFileRef[]) : "");
    }

    // ---- one response per verified email ----
    const emailKey = form.oneResponsePerEmail && verifiedEmail ? verifiedEmail : null;
    if (emailKey) {
      const dup = await db
        .select({ id: formSubmissionsTable.id })
        .from(formSubmissionsTable)
        .where(and(eq(formSubmissionsTable.formId, form.id), eq(formSubmissionsTable.emailKey, emailKey)))
        .limit(1);
      if (dup.length > 0) throw new Error("This email address has already responded to this form.");
    }

    // ---- insert (quota-checked, atomic). Unique indexes make the rules race-proof. ----
    let created: { id: string; createdAt: Date | null } | undefined;
    try {
      const result = await withResponseQuota(form.id, form.createdBy, (tx) =>
        tx
          .insert(formSubmissionsTable)
          .values({
            formId: form.id,
            versionId: version.id,
            values: fields.map((f) => ({ fieldId: f.id, value: answers.get(f.id) ?? "" })),
            respondentEmail: verifiedEmail,
            emailKey,
            idempotencyKey: idempotencyKey ?? null,
          })
          .returning({ id: formSubmissionsTable.id, createdAt: formSubmissionsTable.createdAt }),
      );
      created = result[0];
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint?.includes("idempotency") && idempotencyKey) {
        // Two copies of the same request raced: the other one won — return its response.
        const existing = await this.findByIdempotencyKey(form.id, idempotencyKey);
        if (existing) return existing;
      }
      if (constraint?.includes("email_key")) {
        throw new Error("This email address has already responded to this form.");
      }
      throw error;
    }
    if (!created?.id) throw new Error("Something went wrong while creating the submission");

    if (uploadIdsToAttach.length > 0) {
      const attached = await attachSubmissionFiles(created.id, form.id, uploadIdsToAttach);
      if (!attached) {
        // Someone used the same upload ids concurrently (a double submit). Undo this submission.
        await db.delete(formSubmissionsTable).where(eq(formSubmissionsTable.id, created.id));
        throw new Error("Those files were already submitted. Please upload them again.");
      }
    }

    // An accepted response keeps the form from being closed as idle.
    await db.update(formsTable).set({ lastActivityAt: new Date() }).where(eq(formsTable.id, form.id));

    return { id: created.id, createdAt: created.createdAt ? created.createdAt.toISOString() : null };
  }

  private async findByIdempotencyKey(formId: string, key: string) {
    const row = (
      await db
        .select({ id: formSubmissionsTable.id, createdAt: formSubmissionsTable.createdAt })
        .from(formSubmissionsTable)
        .where(and(eq(formSubmissionsTable.formId, formId), eq(formSubmissionsTable.idempotencyKey, key)))
        .limit(1)
    )[0];
    return row ? { id: row.id, createdAt: row.createdAt ? row.createdAt.toISOString() : null } : null;
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
