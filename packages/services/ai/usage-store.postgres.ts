import { db, sql } from "@repo/database";

import { AiError } from "./errors";
import {
  budgetError,
  quotaError,
  messageCreditUnits,
  type BeginInput,
  type SettleInput,
  type UsageStore,
  type WindowSnapshot,
} from "./usage-store";

/**
 * Postgres implementation of UsageStore.
 *
 * Concurrency model (why this is safe with many API instances):
 *  - admission runs in ONE transaction;
 *  - the per-user window row is locked with SELECT … FOR UPDATE, so two
 *    simultaneous requests from one user are serialised;
 *  - the "one request in flight per user" and "same request id twice"
 *    rules are enforced by unique indexes, not by application checks;
 *  - free-tier ceilings are bumped with a conditional upsert
 *    (… DO UPDATE … WHERE total <= cap), so concurrent requests cannot
 *    overshoot a cap;
 *  - lock order is always window → global-day → global-month → user-day.
 *
 * Timestamps go in as ISO strings cast to timestamptz, and come out as epoch
 * milliseconds — drizzle's pg driver may hand back timestamps as strings in a
 * format `new Date()` does not reliably parse, so we never depend on that.
 */

type Row = Record<string, unknown>;

async function rows(q: PromiseLike<unknown>): Promise<Row[]> {
  const res = (await q) as { rows?: Row[] } | Row[];
  return Array.isArray(res) ? res : (res.rows ?? []);
}

const ts = (d: Date) => d.toISOString();
const num = (v: unknown) => Number(v ?? 0);

export class PostgresUsageStore implements UsageStore {
  async begin(i: BeginInput): Promise<WindowSnapshot> {
    const nowIso = ts(i.now);
    const staleCutoff = ts(new Date(i.now.getTime() - i.staleAfterMs));

    // Best-effort sweep of requests whose server died mid-flight. Runs outside
    // the admission transaction so it sticks even if admission is rejected.
    await db.execute(sql`
      UPDATE ai_requests
         SET status = 'ABANDONED', error_code = 'STALE', completed_at = ${nowIso}::timestamptz
       WHERE user_id = ${i.userId}::uuid
         AND status = 'IN_PROGRESS'
         AND created_at < ${staleCutoff}::timestamptz`);

    return db.transaction(async (tx) => {
      // 1. Idempotency + single-flight, enforced by the unique indexes.
      const inserted = await rows(
        tx.execute(sql`
          INSERT INTO ai_requests
            (user_id, request_id, feature, plan_key, form_id, prompt_chars, estimated_tokens, estimated_cost_micros, created_at)
          VALUES
            (${i.userId}::uuid, ${i.requestId}::uuid, ${i.feature}, ${i.planKey},
             ${i.formId}::uuid, ${i.promptChars}, ${i.estimatedTokens}, ${i.estimatedCostMicros}, ${nowIso}::timestamptz)
          ON CONFLICT DO NOTHING
          RETURNING id`),
      );
      if (inserted.length === 0) {
        const existing = await rows(
          tx.execute(sql`
            SELECT status FROM ai_requests
             WHERE user_id = ${i.userId}::uuid AND request_id = ${i.requestId}::uuid`),
        );
        const status = existing[0]?.status;
        // Same id already finished → replay. Same id still running, or a
        // *different* request is running (the per-user index tripped) → busy.
        throw new AiError(status && status !== "IN_PROGRESS" ? "DUPLICATE_REQUEST" : "REQUEST_IN_PROGRESS");
      }

      // 2. The user's usage window, locked for the rest of the transaction.
      await tx.execute(sql`
        INSERT INTO ai_usage_windows (user_id, feature, window_start, window_end)
        VALUES (${i.userId}::uuid, ${i.feature}, ${nowIso}::timestamptz, NULL)
        ON CONFLICT (user_id, feature) DO NOTHING`);
      const locked = await rows(
        tx.execute(sql`
          SELECT round(extract(epoch FROM window_start) * 1000)::bigint AS start_ms,
                 round(extract(epoch FROM window_end) * 1000)::bigint AS end_ms,
                 requests_used, credits_used, cost_micros_used,
                 (input_tokens_used + output_tokens_used) AS tokens_used
            FROM ai_usage_windows
           WHERE user_id = ${i.userId}::uuid AND feature = ${i.feature}
             FOR UPDATE`),
      );
      const cur = locked[0];
      if (!cur) throw new AiError("INTERNAL", "Usage window row missing after upsert");

      const nowMs = i.now.getTime();
      const currentEnd = cur.end_ms == null ? null : num(cur.end_ms);
      const expired = currentEnd !== null && currentEnd <= nowMs;
      const windowStart = expired ? i.now : new Date(num(cur.start_ms));
      let windowEnd = expired || currentEnd === null ? null : new Date(currentEnd);
      const requestsUsed = expired ? 0 : num(cur.requests_used);
      const tokensUsed = expired ? 0 : num(cur.tokens_used);
      const creditsUsed = expired ? 0 : num(cur.credits_used);

      if (requestsUsed >= i.window.maxRequests || tokensUsed >= i.window.maxTokens || creditsUsed >= 10_000) {
        throw quotaError("window", windowEnd ?? new Date(nowMs + i.window.windowMs), i.now);
      }

      const creditUnits = messageCreditUnits(i.prompt, requestsUsed + 1, i.window.maxRequests, creditsUsed);
      const nextCredits = creditsUsed + creditUnits;
      if (nextCredits >= 10_000 || tokensUsed >= i.window.maxTokens) {
        windowEnd = new Date(nowMs + i.window.windowMs);
      }
      await tx.execute(sql`
        UPDATE ai_usage_windows
           SET window_start = ${ts(windowStart)}::timestamptz,
               window_end = ${windowEnd ? ts(windowEnd) : null}::timestamptz,
               requests_used = ${requestsUsed + 1},
               credits_used = ${nextCredits},
               cost_micros_used = CASE WHEN ${expired} THEN 0 ELSE cost_micros_used END,
               input_tokens_used = CASE WHEN ${expired} THEN 0 ELSE input_tokens_used END,
               output_tokens_used = CASE WHEN ${expired} THEN 0 ELSE output_tokens_used END,
               updated_at = ${nowIso}::timestamptz
         WHERE user_id = ${i.userId}::uuid AND feature = ${i.feature}`);

      // 3. Free-tier ceilings — conditional upserts: no row comes back if a cap would be exceeded.
      for (const b of i.budgets) {
        if (i.estimatedTokens > b.capTokens) throw budgetError(b, i.now);
        const bumped = await rows(
          tx.execute(sql`
            INSERT INTO ai_spend_counters (key, tokens, requests, updated_at)
            VALUES (${b.key}, ${i.estimatedTokens}, 1, ${nowIso}::timestamptz)
            ON CONFLICT (key) DO UPDATE
               SET tokens = ai_spend_counters.tokens + EXCLUDED.tokens,
                   requests = ai_spend_counters.requests + 1,
                   updated_at = EXCLUDED.updated_at
             WHERE ai_spend_counters.tokens + EXCLUDED.tokens <= ${b.capTokens}
               AND ai_spend_counters.requests + 1 <= ${b.capRequests ?? 2_000_000_000}
            RETURNING key`),
        );
        if (bumped.length === 0) throw budgetError(b, i.now);
      }

      return { windowStart, windowEnd, requestsUsed: requestsUsed + 1, tokensUsed, creditsUsed: nextCredits, creditUnits };
    });
  }

  async settle(i: SettleInput): Promise<void> {
    const nowIso = ts(i.now);
    const actualTokens = i.inputTokens + i.outputTokens;
    const tokenDelta = actualTokens - i.estimatedTokens;
    const refund = i.countRequest ? 0 : 1;

    await db.transaction(async (tx) => {
      // Only the first settle wins; a request already swept as ABANDONED keeps its reservation.
      const updated = await rows(
        tx.execute(sql`
          UPDATE ai_requests
             SET status = ${i.status}::ai_request_status_enum,
                 provider = ${i.provider}, model = ${i.model}, intent = ${i.intent},
                 attempts = ${i.attempts}, fallback_used = ${i.fallbackUsed},
                 input_tokens = ${i.inputTokens}, output_tokens = ${i.outputTokens},
                 cost_micros = ${i.actualCostMicros},
                 latency_ms = ${i.latencyMs}, first_token_ms = ${i.firstTokenMs},
                 error_code = ${i.errorCode}, completed_at = ${nowIso}::timestamptz
           WHERE user_id = ${i.userId}::uuid AND request_id = ${i.requestId}::uuid
             AND status = 'IN_PROGRESS'
          RETURNING id`),
      );
      if (updated.length === 0) return;

      // Skipped automatically if the window rolled over while the request ran.
      await tx.execute(sql`
        UPDATE ai_usage_windows
           SET requests_used = GREATEST(requests_used - ${refund}, 0),
             credits_used = GREATEST(credits_used - ${i.countRequest ? 0 : i.creditUnits}, 0),
             cost_micros_used = cost_micros_used + ${i.actualCostMicros},
             input_tokens_used = input_tokens_used + ${i.inputTokens},
             output_tokens_used = output_tokens_used + ${i.outputTokens},
             window_end = CASE
               WHEN (GREATEST(requests_used - ${refund}, 0) >= ${i.maxRequests}
                     OR input_tokens_used + output_tokens_used + ${i.inputTokens} + ${i.outputTokens} >= ${i.maxTokens}
                     OR GREATEST(credits_used - ${i.countRequest ? 0 : i.creditUnits}, 0) >= 10000)
                 THEN COALESCE(window_end, ${ts(new Date(i.now.getTime() + i.windowMs))}::timestamptz)
               ELSE NULL
             END,
             updated_at = ${nowIso}::timestamptz
         WHERE user_id = ${i.userId}::uuid AND feature = ${i.feature}
           AND window_start = ${ts(i.windowStart)}::timestamptz`);

      for (const key of i.budgetKeys) {
        await tx.execute(sql`
          UPDATE ai_spend_counters
             SET tokens = GREATEST(tokens + ${tokenDelta}, 0),
                 requests = GREATEST(requests - ${refund}, 0),
                 cost_micros = cost_micros + ${i.actualCostMicros},
                 updated_at = ${nowIso}::timestamptz
           WHERE key = ${key}`);
      }
    });
  }

  async snapshot(userId: string, feature: string, now: Date): Promise<WindowSnapshot | null> {
    const r = await rows(
      db.execute(sql`
        SELECT round(extract(epoch FROM window_start) * 1000)::bigint AS start_ms,
               round(extract(epoch FROM window_end) * 1000)::bigint AS end_ms,
               requests_used, credits_used, (input_tokens_used + output_tokens_used) AS tokens_used
          FROM ai_usage_windows
         WHERE user_id = ${userId}::uuid AND feature = ${feature}`),
    );
    const row = r[0];
    if (!row) return null;
    const end = row.end_ms == null ? null : new Date(num(row.end_ms));
    if (end && end.getTime() <= now.getTime()) return null;
    return {
      windowStart: new Date(num(row.start_ms)),
      windowEnd: end,
      requestsUsed: num(row.requests_used),
      tokensUsed: num(row.tokens_used),
      creditsUsed: num(row.credits_used),
      creditUnits: 0,
    };
  }
}
