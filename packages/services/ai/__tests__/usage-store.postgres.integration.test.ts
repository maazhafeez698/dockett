/**
 * Integration tests for PostgresUsageStore — these need a REAL database with
 * the Phase 6 migration applied, so they are skipped unless opted in:
 *
 *   AI_INTEGRATION_TESTS=1 DATABASE_URL=postgres://… pnpm --filter api test:ai:integration
 *
 * Use a throwaway/dev database. Each test creates its own user and deletes
 * it afterwards (usage rows cascade), but the global spend counters it
 * touches use unique keys per run.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const enabled = process.env.AI_INTEGRATION_TESTS === "1" && !!process.env.DATABASE_URL;

import type { BeginInput } from "../usage-store";

const windowLimits = { windowMs: 5 * 3600_000, maxRequests: 3, maxTokens: 10_000 };
const mkBegin = (userId: string, budgets: BeginInput["budgets"], over: Partial<BeginInput> = {}): BeginInput => ({
  userId, requestId: randomUUID(), feature: "FORM_BUILDER", planKey: "free", formId: null, prompt: "test prompt", promptChars: 10,
  estimatedTokens: 1000, estimatedCostMicros: 1000, window: windowLimits, budgets, staleAfterMs: 120_000, now: new Date(), ...over,
});

test("PostgresUsageStore (integration)", { skip: !enabled && "set AI_INTEGRATION_TESTS=1 and DATABASE_URL to run" }, async (t) => {
  const { db, sql } = await import("@repo/database");
  const { PostgresUsageStore } = await import("../usage-store.postgres");
  const { AiError } = await import("../errors");
  const store = new PostgresUsageStore();
  const users: string[] = [];
  const runKey = randomUUID().slice(0, 8);

  async function newUser() {
    const id = randomUUID();
    await db.execute(sql`INSERT INTO users (id, full_name, email) VALUES (${id}::uuid, 'AI Test', ${`ai-test-${id}@example.test`})`);
    users.push(id);
    return id;
  }
  const big = (k: string) => [{ key: `test:${runKey}:${k}`, capTokens: 1_000_000_000, scope: "global" as const }];
  const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof AiError ? e.code : `ERR:${String(e)}`));

  t.after(async () => {
    for (const id of users) await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    await db.execute(sql`DELETE FROM ai_spend_counters WHERE key LIKE ${`test:${runKey}:%`}`);
  });

  await t.test("admit → snapshot → settle with refund", async () => {
    const u = await newUser();
    const b = mkBegin(u, big("a"));
    const win = await store.begin(b);
    assert.equal(win.requestsUsed, 1);
    assert.equal(win.windowEnd, null);
    assert.equal(win.creditsUsed, win.creditUnits);
    const snap = await store.snapshot(u, "FORM_BUILDER", new Date());
    assert.equal(snap?.requestsUsed, 1);
    await store.settle({
      userId: u, requestId: b.requestId, feature: "FORM_BUILDER", status: "FAILED", provider: "gemini", model: "m", intent: null, attempts: 1,
      fallbackUsed: false, inputTokens: 0, outputTokens: 0, estimatedTokens: 1000, estimatedCostMicros: 1000, actualCostMicros: 0, countRequest: false,
      latencyMs: 5, firstTokenMs: null, errorCode: "PROVIDER_UNAVAILABLE", windowStart: win.windowStart, budgetKeys: b.budgets.map((x) => x.key),
      creditUnits: win.creditUnits, maxRequests: windowLimits.maxRequests, maxTokens: windowLimits.maxTokens, windowMs: windowLimits.windowMs, now: new Date(),
    });
    assert.equal((await store.snapshot(u, "FORM_BUILDER", new Date()))?.requestsUsed, 0);
  });

  await t.test("quota enforced; window rolls over after expiry", async () => {
    const u = await newUser();
    const t0 = new Date();
    for (let i = 0; i < 3; i++) {
      const b = mkBegin(u, big("q"), { now: new Date(t0.getTime() + i * 1000) });
      const win = await store.begin(b);
      await store.settle({ userId: u, requestId: b.requestId, feature: "FORM_BUILDER", status: "SUCCEEDED", provider: "g", model: "m", intent: "BUILD", attempts: 1, fallbackUsed: false, inputTokens: 1, outputTokens: 1, estimatedTokens: 1000, estimatedCostMicros: 1000, actualCostMicros: 500, countRequest: true, latencyMs: 1, firstTokenMs: 1, errorCode: null, windowStart: win.windowStart, budgetKeys: [], creditUnits: win.creditUnits, maxRequests: windowLimits.maxRequests, maxTokens: windowLimits.maxTokens, windowMs: windowLimits.windowMs, now: new Date(t0.getTime() + i * 1000 + 500) });
    }
    assert.equal(await code(store.begin(mkBegin(u, big("q"), { now: new Date(t0.getTime() + 5000) }))), "QUOTA_EXCEEDED");
    const later = new Date(t0.getTime() + windowLimits.windowMs + 10_000);
    const w = await store.begin(mkBegin(u, big("q"), { now: later }));
    assert.equal(w.requestsUsed, 1);
  });

  await t.test("same requestId twice → DUPLICATE_REQUEST; concurrent different requests → exactly one admitted", async () => {
    const u = await newUser();
    const b = mkBegin(u, big("d"));
    await store.begin(b);
    assert.equal(await code(store.begin({ ...b })), "REQUEST_IN_PROGRESS");
    await db.execute(sql`UPDATE ai_requests SET status = 'SUCCEEDED' WHERE user_id = ${u}::uuid`);
    assert.equal(await code(store.begin({ ...b })), "DUPLICATE_REQUEST");

    const u2 = await newUser();
    const results = await Promise.all(Array.from({ length: 8 }, () => code(store.begin(mkBegin(u2, big("d"))))));
    assert.equal(results.filter((r) => r === "ok").length, 1, JSON.stringify(results));
    assert.equal(results.filter((r) => r === "REQUEST_IN_PROGRESS").length, 7, JSON.stringify(results));
  });

  await t.test("token ceiling cannot be overshot under concurrency", async () => {
    const cap = [{ key: `test:${runKey}:cap`, capTokens: 5000, scope: "global" as const }];
    const users2 = await Promise.all(Array.from({ length: 12 }, newUser));
    const results = await Promise.all(users2.map((u) => code(store.begin(mkBegin(u, cap, { estimatedTokens: 1000 })))));
    assert.equal(results.filter((r) => r === "ok").length, 5, JSON.stringify(results));
    assert.equal(results.filter((r) => r === "CAPACITY_REACHED").length, 7);
    const row = await db.execute(sql`SELECT tokens FROM ai_spend_counters WHERE key = ${`test:${runKey}:cap`}`);
    assert.equal(Number(((row as any).rows ?? row)[0].tokens), 5000);
  });

  await t.test("requests-per-day ceiling (Google RPD) cannot be overshot under concurrency", async () => {
    const cap = [{ key: `test:${runKey}:rpd`, capTokens: 1_000_000, capRequests: 4, scope: "global" as const }];
    const users3 = await Promise.all(Array.from({ length: 10 }, newUser));
    const results = await Promise.all(users3.map((u) => code(store.begin(mkBegin(u, cap)))));
    assert.equal(results.filter((r) => r === "ok").length, 4, JSON.stringify(results));
  });

  await t.test("token credits: a user at/over the window token cap is refused; settle adds real tokens", async () => {
    const u = await newUser();
    const t0 = new Date();
    const b = mkBegin(u, big("tok"), { now: t0 });
    const win = await store.begin(b);
    await store.settle({ userId: u, requestId: b.requestId, feature: "FORM_BUILDER", status: "SUCCEEDED", provider: "g", model: "m", intent: "BUILD", attempts: 1, fallbackUsed: false, inputTokens: 6000, outputTokens: 4500, estimatedTokens: 1000, estimatedCostMicros: 1000, actualCostMicros: 500, countRequest: true, latencyMs: 1, firstTokenMs: 1, errorCode: null, windowStart: win.windowStart, budgetKeys: [], creditUnits: win.creditUnits, maxRequests: windowLimits.maxRequests, maxTokens: windowLimits.maxTokens, windowMs: windowLimits.windowMs, now: new Date(t0.getTime() + 500) });
    assert.equal((await store.snapshot(u, "FORM_BUILDER", new Date(t0.getTime() + 600)))?.tokensUsed, 10_500);
    assert.equal(await code(store.begin(mkBegin(u, big("tok"), { now: new Date(t0.getTime() + 1000) }))), "QUOTA_EXCEEDED");
  });

  await t.test("a rejected admission leaves no trace (no stuck in-flight row, no partial charge)", async () => {
    const u = await newUser();
    const tight = [{ key: `test:${runKey}:tight`, capTokens: 10, scope: "global" as const }];
    assert.equal(await code(store.begin(mkBegin(u, tight))), "CAPACITY_REACHED");
    const res = await db.execute(sql`SELECT count(*)::int AS n FROM ai_requests WHERE user_id = ${u}::uuid`);
    assert.equal(Number(((res as any).rows ?? res)[0].n), 0);
    assert.equal(await store.snapshot(u, "FORM_BUILDER", new Date()), null);
  });

  await t.test("stale in-flight request is swept", async () => {
    const u = await newUser();
    const t0 = new Date();
    await store.begin(mkBegin(u, big("s"), { now: t0 }));
    const later = new Date(t0.getTime() + 200_000);
    const w = await store.begin(mkBegin(u, big("s"), { now: later, staleAfterMs: 120_000 }));
    assert.ok(w.requestsUsed >= 1);
  });
});
