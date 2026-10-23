import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

// Dockett sign-up email verification. Only the SHA-256 hash of the token is stored;
// the raw token exists only in the email. A token is single-use (usedAt) and expires.
export const emailVerificationTokensTable = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // Resend throttling counts a user's recent tokens.
  (t) => [index("email_verification_user_created_idx").on(t.userId, t.createdAt)],
);
