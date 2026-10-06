import { pgTable, uuid, timestamp, json, index } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
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

    // Set when the respondent was signed in to a Formless account at submit
    // time (AUTHENTICATED_ONLY forms always have this; ANYONE/ACCESS_CODE
    // forms may or may not, depending on whether the visitor happened to be
    // logged in). Null means an anonymous submission.
    submittedBy: uuid("submitted_by").references(() => usersTable.id),

    values: json("values").$type<FormSubmissionValueRow>(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  // Monthly response quota: count of a form's submissions since the start of the month.
  (t) => [index("form_submissions_form_created_idx").on(t.formId, t.createdAt)],
);
