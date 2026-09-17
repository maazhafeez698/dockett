import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  tokenHash: text("token_hash").notNull().unique(),

  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),

  createdAt: timestamp("created_at").defaultNow(),
});
