import { boolean, index, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const formStatusEnum = pgEnum("form_status_enum", ["DRAFT", "PUBLISHED", "CLOSED"]);

export const formVisibilityEnum = pgEnum("form_visibility_enum", ["PUBLIC", "UNLISTED"]);

export const formSubmissionAccessEnum = pgEnum("form_submission_access_enum", [
  "ANYONE",
  "ACCESS_CODE",
  "AUTHENTICATED_ONLY",
]);

export const formRespondentIdentityEnum = pgEnum("form_respondent_identity_enum", [
  "ANONYMOUS",
  "VERIFIED_EMAIL",
]);

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

export const formSubmissionLayoutEnum = pgEnum("form_submission_layout_enum", [
  "ONE_AT_A_TIME",
  "ALL_AT_ONCE",
]);

export interface FormDesignSettings {
  accentColor?: string;
  surfaceMode?: "LIGHT" | "DARK";
  typography?: "SANS" | "SERIF" | "MONO";
  corners?: "SOFT" | "SHARP";
}

export const formsTable = pgTable(
  "forms",
  {
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
    designSettings: jsonb("design_settings").$type<FormDesignSettings>().notNull().default({}),

    accessCode: varchar("access_code", { length: 12 }),

    respondentIdentity: formRespondentIdentityEnum("respondent_identity")
      .default("ANONYMOUS")
      .notNull(),
    // Only meaningful with VERIFIED_EMAIL: one response per verified address.
    oneResponsePerEmail: boolean("one_response_per_email").default(false).notNull(),

    publishedVersionId: uuid("published_version_id"),

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
