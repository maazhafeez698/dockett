import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { formSubmissionsTable } from "./form-submission";
import { usersTable } from "./user";

// PENDING   — a signature was issued; the browser may be uploading right now.
// CONFIRMED — the server checked the stored object (size + magic bytes) and accepted it.
// ATTACHED  — the file is part of a submission.
export const fileUploadStatusEnum = pgEnum("file_upload_status_enum", [
  "PENDING",
  "CONFIRMED",
  "ATTACHED",
]);

// One row per issued upload. Every foreign key is ON DELETE SET NULL on purpose: deleting a form,
// field or submission must never silently orphan an object in storage. The cleanup job treats
// "ATTACHED but missing its form/field/submission" as garbage and removes the stored object too.
export const fileUploadsTable = pgTable(
  "file_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id").references(() => formsTable.id, { onDelete: "set null" }),
    // Plain id, no FK: a field may be removed from the draft after a version containing it was
    // published, and files already submitted to that version must stay.
    fieldId: uuid("field_id"),
    submissionId: uuid("submission_id").references(() => formSubmissionsTable.id, {
      onDelete: "set null",
    }),
    // The form owner at upload time — used for the per-owner storage quota.
    ownerId: uuid("owner_id").references(() => usersTable.id, { onDelete: "set null" }),

    // "u:<userId>" for signed-in respondents, "ip:<hmac>" for anonymous ones (never the raw IP).
    actorKey: varchar("actor_key", { length: 80 }).notNull(),

    // Random object key in storage (never derived from the user's filename).
    storageKey: varchar("storage_key", { length: 255 }).notNull().unique(),
    // Canonical kind decided by the server: pdf | docx | jpg | png.
    kind: varchar("kind", { length: 8 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    // Sanitised original name — display / download name only.
    displayName: varchar("display_name", { length: 200 }).notNull(),
    // Verified size, set at confirm time.
    bytes: integer("bytes"),

    status: fileUploadStatusEnum("status").notNull().default("PENDING"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at"),
    attachedAt: timestamp("attached_at"),
  },
  (t) => [
    index("file_uploads_status_created_idx").on(t.status, t.createdAt),
    index("file_uploads_form_status_idx").on(t.formId, t.status),
    index("file_uploads_owner_idx").on(t.ownerId),
    index("file_uploads_actor_status_idx").on(t.actorKey, t.status),
    index("file_uploads_submission_idx").on(t.submissionId),
  ],
);
