import { index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { usersTable } from "./user";

/** A field exactly as it was when the version was published (same shape the API returns). */
export interface FormSnapshotField {
  id: string;
  formId: string | null;
  label: string;
  labelKey: string;
  description: string | null;
  placeholder: string | null;
  isRequired: boolean;
  config: unknown;
  index: string;
  type: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Everything a respondent sees and is validated against, frozen at publish time. */
export interface FormSnapshot {
  title: string;
  description: string | null;
  template: string;
  submissionLayout: string;
  fields: FormSnapshotField[];
}

// One row per publication that changed the content. Rows are only ever INSERTED —
// there is no update path — so a response can always be read against the exact
// version it was submitted to.
export const formVersionsTable = pgTable(
  "form_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    // 1, 2, 3 ... per form.
    version: integer("version").notNull(),

    // sha256 of the canonical snapshot: lets the builder tell "unpublished changes" cheaply.
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    snapshot: jsonb("snapshot").$type<FormSnapshot>().notNull(),

    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("form_versions_form_version_idx").on(t.formId, t.version)],
);
