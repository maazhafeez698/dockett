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

/**
 * Phase 6 — AI usage accounting.
 *
 * Deliberate choices, worth knowing before touching these tables:
 *  - Every timestamp here is `timestamptz`. The older tables use plain
 *    `timestamp`; the AI limiter does window arithmetic in SQL, where an
 *    ambiguous zone is a real bug source, so these are unambiguous.
 *  - Token safety limits are tracked independently from the prompt-weighted
 *    user-facing credit allocation. Money figures are NOTIONAL (free tier = $0)
 *    and stored as integer micro-USD (1 = $0.000001) in bigint columns — no floats.
 *  - Nothing here stores prompt or response text. Only sizes, token counts,
 *    cost, timing and error codes — enough to diagnose and bill, nothing
 *    users typed.
 *  - `feature` is a column (not hard-wired) so future AI features share the
 *    same limiter; today the only value is FORM_BUILDER.
 */

export const aiRequestStatusEnum = pgEnum("ai_request_status_enum", [
  "IN_PROGRESS",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "ABANDONED",
]);

/**
 * One row per AI request. Doubles as:
 *  1. the audit/usage log (tokens, cost, model, latency, error code),
 *  2. the idempotency record — (user_id, request_id) is unique, so a replayed
 *     request id can never trigger a second paid model call, and
 *  3. the in-flight lock — the partial unique index below allows at most one
 *     IN_PROGRESS row per user.
 */
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

/**
 * Free-tier ceilings keyed by a namespaced string, e.g.
 *   global:day:2026-09-30        — whole-app daily requests/tokens (Pacific day, like Google's RPD reset)
 *   user:<uuid>:day:2026-09-30   — one user's daily tokens
 * Admission increments these atomically and only if the cap still holds, so
 * concurrent requests cannot overshoot a ceiling.
 */
export const aiSpendCountersTable = pgTable("ai_spend_counters", {
  key: varchar("key", { length: 120 }).primaryKey(),
  tokens: bigint("tokens", { mode: "number" }).notNull().default(0),
  // Notional cost (informational).
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
  requests: integer("requests").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
