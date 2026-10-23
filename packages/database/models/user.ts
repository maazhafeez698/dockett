import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  fullName: varchar("full_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),

  // Whether the owner of this address has proven it (verification link, Google, or a
  // password reset). New password sign-ups are inserted with `false` and can't sign in
  // until verified. The column default is `true` ON PURPOSE: it keeps every account that
  // existed before email verification shipped working, without a data backfill.
  emailVerified: boolean("email_verified").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});
