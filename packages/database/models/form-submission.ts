import { pgTable, uuid, timestamp, json, index, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { formVersionsTable } from "./form-version";
import { usersTable } from "./user";

export interface FormSubmissionValue {
  fieldId: string;
  value: string;
}

export type FormSubmissionValueRow = FormSubmissionValue[];

export const formSubmissionsTable = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id").references(() => formsTable.id, { onDelete: "cascade" }),

    // The published version this response was submitted to (and validated against).
    // Null only for responses collected before versioning existed.
    versionId: uuid("version_id").references(() => formVersionsTable.id),

    // Legacy: set when a signed-in Dockett user submitted (older forms). New
    // responses never use it — respondents don't need an account.
    submittedBy: uuid("submitted_by").references(() => usersTable.id),

    // The verified email (VERIFIED_EMAIL forms), lower-cased.
    respondentEmail: varchar("respondent_email", { length: 255 }),
    // Same address, set ONLY while the form enforces one response per email; the
    // unique index below is what makes that rule race-proof.
    emailKey: varchar("email_key", { length: 255 }),
    // Client-generated per fill attempt: a retried request returns the original response.
    idempotencyKey: varchar("idempotency_key", { length: 64 }),

    values: json("values").$type<FormSubmissionValueRow>(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  // Monthly response quota: count of a form's submissions since the start of the month.
  (t) => [
    index("form_submissions_form_created_idx").on(t.formId, t.createdAt),
    index("form_submissions_version_idx").on(t.versionId),
    // NULLs are distinct in Postgres, so rows without an email key never collide.
    uniqueIndex("form_submissions_email_key_idx").on(t.formId, t.emailKey),
    uniqueIndex("form_submissions_idempotency_idx").on(t.formId, t.idempotencyKey),
  ],
);
