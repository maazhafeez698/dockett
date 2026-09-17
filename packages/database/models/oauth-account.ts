import { pgTable, pgEnum, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const oauthProviderEnum = pgEnum("oauth_provider", ["google"]);

export const oauthAccountsTable = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    provider: oauthProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [unique("oauth_provider_account_unique").on(table.provider, table.providerAccountId)],
);
