import { pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const formStatusEnum = pgEnum("form_status_enum", ["DRAFT", "PUBLISHED", "CLOSED"]);
export const formVisibilityEnum = pgEnum("form_visibility_enum", ["PUBLIC", "UNLISTED"]);

// ANYONE — no gate. ACCESS_CODE — respondent must enter the form's shared
// code before the fields are returned/accepted (owner is always exempt).
// AUTHENTICATED_ONLY — respondent must be signed in to a Formless account
// (not necessarily the owner). Enforced end-to-end in Phase 4
// (getFormWithFields + createSubmission), not just stored.
export const formSubmissionAccessEnum = pgEnum("form_submission_access_enum", [
  "ANYONE",
  "ACCESS_CODE",
  "AUTHENTICATED_ONLY",
]);

// Replaces the old 5-preset color `theme` enum (Phase 3). A template is no
// longer just an accent/gradient — it's a full distinct structure, layout,
// and interaction model, implemented client-side in
// apps/web/components/form-templates/*. CLASSIC is the plain Formless
// look — the default for forms created from scratch ("Custom Form"), not
// offered as a gallery pick.
export const formTemplateEnum = pgEnum("form_template_enum", [
  "CORPORATE",
  "SURVEY",
  "EDUCATION",
  "DEVELOPER",
  "RETRO",
  "INVITATION",
  "TICKET",
  "LANDING",
  "CLASSIC",
]);

// How the respondent-facing page paces the fields. Configurable per form —
// not hardcoded to either extreme — and honored consistently by every
// template shell and by CLASSIC.
export const formSubmissionLayoutEnum = pgEnum("form_submission_layout_enum", [
  "ONE_AT_A_TIME",
  "ALL_AT_ONCE",
]);

export const formsTable = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),

  title: varchar("title", { length: 50 }).notNull(),
  description: varchar("decription", { length: 300 }),

  status: formStatusEnum("status").default("DRAFT").notNull(),
  visibility: formVisibilityEnum("visibility").default("PUBLIC").notNull(),
  submissionAccess: formSubmissionAccessEnum("submission_access").default("ANYONE").notNull(),

  template: formTemplateEnum("template").default("CLASSIC").notNull(),
  submissionLayout: formSubmissionLayoutEnum("submission_layout")
    .default("ONE_AT_A_TIME")
    .notNull(),

  // Set only when submissionAccess = ACCESS_CODE. Short, shareable,
  // human-typeable — this gates *response access*, not a security secret on
  // the level of a password, so it's stored as plain text (same trust model
  // as a meeting-invite code or a game room code).
  accessCode: varchar("access_code", { length: 12 }),

  createdBy: uuid("created_by").references(() => usersTable.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});
