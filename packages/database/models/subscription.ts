import {
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const subscriptionStatusEnum = pgEnum("subscription_status_enum", [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "PAUSED",
  "CANCELED",
]);

export const subscriptionSourceEnum = pgEnum("subscription_source_enum", ["PADDLE", "MANUAL"]);

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // One subscription row per user; a re-subscription replaces the row.
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    planKey: varchar("plan_key", { length: 20 }).notNull(), // "premium" | "business"
    status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
    source: subscriptionSourceEnum("source").notNull().default("PADDLE"),

    paddleSubscriptionId: varchar("paddle_subscription_id", { length: 64 }),
    paddleCustomerId: varchar("paddle_customer_id", { length: 64 }),
    paddlePriceId: varchar("paddle_price_id", { length: 64 }),
    billingCycle: varchar("billing_cycle", { length: 10 }), // "month" | "year"

    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    // Scheduled cancellation: access continues until currentPeriodEnd.
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    // Set when a payment fails; access is kept until this moment, then drops to Basic.
    graceUntil: timestamp("grace_until", { withTimezone: true }),

    // occurred_at of the newest Paddle event applied — older (out-of-order) events are ignored.
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_user_uq").on(t.userId),
    uniqueIndex("subscriptions_paddle_sub_uq").on(t.paddleSubscriptionId),
    index("subscriptions_customer_idx").on(t.paddleCustomerId),
  ],
);

export const billingEventsTable = pgTable("billing_events", {
  eventId: varchar("event_id", { length: 64 }).primaryKey(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  outcome: varchar("outcome", { length: 20 }).notNull().default("APPLIED"), // APPLIED | STALE | IGNORED
});

export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;
export type SubscriptionInsert = typeof subscriptionsTable.$inferInsert;
