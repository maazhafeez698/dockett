import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { formsTable } from "./form";

// "Verified email" forms: a respondent asks for a magic link for an address. One row per
// link sent. Only the token's SHA-256 hash is stored; links are single-use and short-lived.
export const formRespondentChallengesTable = pgTable(
  "form_respondent_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    // Lower-cased address the link was sent to.
    email: varchar("email", { length: 255 }).notNull(),

    // Random id kept by the respondent's browser for one fill attempt. Asking for a link
    // again (e.g. after correcting a typo'd address) invalidates the earlier pending links
    // that carry the same nonce.
    nonce: varchar("nonce", { length: 64 }).notNull(),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("form_respondent_challenges_form_email_idx").on(t.formId, t.email, t.createdAt),
    index("form_respondent_challenges_form_nonce_idx").on(t.formId, t.nonce),
  ],
);
