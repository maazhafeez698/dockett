import { pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

// Schema only in this phase — status/visibility are added here so the
// column exists, but enforcement (what a DRAFT/UNLISTED form actually
// blocks) lands in Phase 4 alongside the rest of publish/visibility.
export const formStatusEnum = pgEnum("form_status_enum", ["DRAFT", "PUBLISHED", "CLOSED"]);
export const formVisibilityEnum = pgEnum("form_visibility_enum", ["PUBLIC", "UNLISTED"]);
export const formSubmissionAccessEnum = pgEnum("form_submission_access_enum", [
  "ANYONE",
  "AUTHENTICATED_ONLY",
  "ANONYMOUS_ONLY",
]);

// Kept in sync with FORM_THEMES in apps/web/lib/form-themes.ts — a curated
// preset list, not a free-form color picker.
export const formThemeEnum = pgEnum("form_theme_enum", [
  "MIDNIGHT",
  "CORAL",
  "MINT",
  "LAVENDER",
  "OCEAN",
]);

export const formsTable = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),

  title: varchar("title", { length: 50 }).notNull(),
  description: varchar("decription", { length: 300 }),

  status: formStatusEnum("status").default("DRAFT").notNull(),
  visibility: formVisibilityEnum("visibility").default("PUBLIC").notNull(),
  submissionAccess: formSubmissionAccessEnum("submission_access").default("ANYONE").notNull(),
  theme: formThemeEnum("theme").default("MIDNIGHT").notNull(),

  createdBy: uuid("created_by").references(() => usersTable.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});
