import { boolean, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const formStatusEnum = pgEnum("form_status_enum", ["DRAFT", "PUBLISHED", "CLOSED"]);

// ANYONE — anyone with the link. ACCESS_CODE — respondent must also enter the
// form's shared code before the fields are returned/accepted (owner is exempt).
// AUTHENTICATED_ONLY is DEPRECATED: Dockett no longer asks respondents to have
// an account (see formRespondentIdentityEnum). The value stays in the enum only
// so existing rows stay valid; the app never writes it and treats it as ANYONE.
export const formSubmissionAccessEnum = pgEnum("form_submission_access_enum", [
  "ANYONE",
  "ACCESS_CODE",
  "AUTHENTICATED_ONLY",
]);

// Who a respondent is. ANONYMOUS — anyone with the link can submit, no checks.
// VERIFIED_EMAIL — the respondent proves they own an email address through a
// magic link (no Dockett account involved); the address is stored with the
// response and can optionally be limited to one response per form.
export const formRespondentIdentityEnum = pgEnum("form_respondent_identity_enum", [
  "ANONYMOUS",
  "VERIFIED_EMAIL",
]);

// Replaces the old 5-preset color `theme` enum (Phase 3). A template is no
// longer just an accent/gradient — it's a full distinct structure, layout,
// and interaction model, implemented client-side in
// apps/web/components/form-templates/*. CLASSIC is the plain Dockett
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

export const formsTable = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    title: varchar("title", { length: 50 }).notNull(),
    description: varchar("decription", { length: 300 }),

    status: formStatusEnum("status").default("DRAFT").notNull(),
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

    respondentIdentity: formRespondentIdentityEnum("respondent_identity")
      .default("ANONYMOUS")
      .notNull(),
    // Only meaningful with VERIFIED_EMAIL: one response per verified address.
    oneResponsePerEmail: boolean("one_response_per_email").default(false).notNull(),

    // The immutable snapshot (form_versions) respondents currently see and are
    // validated against. Null until the form is published for the first time.
    // (No FK on purpose: forms <-> form_versions would be circular.)
    publishedVersionId: uuid("published_version_id"),

    // Server-side automatic closure. The API checks it on every read/submit AND a
    // background sweep flips status to CLOSED, so nothing depends on a browser.
    closesAt: timestamp("closes_at"),
    // Why a CLOSED form closed: MANUAL | SCHEDULED | INACTIVE (null otherwise).
    closedReason: varchar("closed_reason", { length: 16 }),
    // Last publish or accepted submission; a form idle for a month is closed by the system.
    lastActivityAt: timestamp("last_activity_at"),

    createdBy: uuid("created_by").references(() => usersTable.id),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  // Plan enforcement counts a user's published forms on every publish and every public view.
  (t) => [
    index("forms_created_by_status_idx").on(t.createdBy, t.status),
    // The closing sweep scans published forms by deadline / idleness.
    index("forms_status_closes_idx").on(t.status, t.closesAt),
    index("forms_status_activity_idx").on(t.status, t.lastActivityAt),
  ],
);
