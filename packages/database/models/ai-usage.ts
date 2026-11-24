import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./user";

export const aiRequestStatusEnum = pgEnum("ai_request_status_enum", [
  "IN_PROGRESS",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "ABANDONED",
]);

export const aiRequestsTable = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Client-generated idempotency key (one per user-initiated send).
    requestId: uuid("request_id").notNull(),
    feature: varchar("feature", { length: 40 }).notNull().default("FORM_BUILDER"),
    planKey: varchar("plan_key", { length: 40 }).notNull().default("free"),
    // Set when the request targets an existing form (no FK on purpose: usage
    // history must survive the form being deleted).
    formId: uuid("form_id"),

    status: aiRequestStatusEnum("status").notNull().default("IN_PROGRESS"),

    // What actually served the request (last attempt that produced output).
    provider: varchar("provider", { length: 40 }),
    model: varchar("model", { length: 100 }),
    attempts: integer("attempts").notNull().default(0),
    fallbackUsed: boolean("fallback_used").notNull().default(false),

    // What the model said the message was (BUILD / CLARIFY / CHAT / OFF_TOPIC); null if it never answered.
    intent: varchar("intent", { length: 20 }),

    promptChars: integer("prompt_chars").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // Worst-case tokens reserved at admission (trued-up to input/output tokens at settle).
    estimatedTokens: integer("estimated_tokens").notNull().default(0),
    // NOTIONAL cost in micro-USD (what the tokens would cost on a paid plan). The free tier charges $0;
    // this exists so a future paid plan can bill from real data.
    estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }).notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),

    latencyMs: integer("latency_ms"),
    firstTokenMs: integer("first_token_ms"),
    errorCode: varchar("error_code", { length: 40 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("ai_requests_user_request_uq").on(t.userId, t.requestId),
    uniqueIndex("ai_requests_one_in_flight_per_user_uq")
      .on(t.userId)
      .where(sql`status = 'IN_PROGRESS'`),
    index("ai_requests_user_created_idx").on(t.userId, t.createdAt),
    index("ai_requests_created_idx").on(t.createdAt),
  ],
);

/**
 * The per-user usage window ("session"). One row per (user, feature);
 * `window_end` stays null until a limit is reached. Once the cooldown ends, the
 * next request resets the counters. Window length and limits come from config.
 */
export const aiUsageWindowsTable = pgTable(
  "ai_usage_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    feature: varchar("feature", { length: 40 }).notNull().default("FORM_BUILDER"),

    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    requestsUsed: integer("requests_used").notNull().default(0),
    // Reserved credit allowance, in basis points (10,000 = 100%).
    creditsUsed: integer("credits_used").notNull().default(0),
    // Provider token usage, separate from the prompt-weighted credit allocation.
    inputTokensUsed: bigint("input_tokens_used", { mode: "number" }).notNull().default(0),
    outputTokensUsed: bigint("output_tokens_used", { mode: "number" }).notNull().default(0),
    // Notional cost (informational).
    costMicrosUsed: bigint("cost_micros_used", { mode: "number" }).notNull().default(0),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ai_usage_windows_user_feature_uq").on(t.userId, t.feature)],
);

export const aiSpendCountersTable = pgTable("ai_spend_counters", {
  key: varchar("key", { length: 120 }).primaryKey(),
  tokens: bigint("tokens", { mode: "number" }).notNull().default(0),
  // Notional cost (informational).
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
  requests: integer("requests").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
