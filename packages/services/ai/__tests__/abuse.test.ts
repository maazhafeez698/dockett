import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelQuota, StrikeTracker } from "../resilience";
import { quotaDay, nextQuotaDayStart } from "../quota-day";
import { FakeClock } from "./helpers";

test("StrikeTracker: pauses after N strikes inside the window, releases as they age out", () => {
  const clock = new FakeClock();
  const s = new StrikeTracker(3, 10 * 60_000, clock);
  s.record("u"); clock.advance(60_000);
  s.record("u"); clock.advance(60_000);
  assert.equal(s.cooldownMs("u"), 0);
  s.record("u");
  const wait = s.cooldownMs("u");
  assert.ok(wait > 7 * 60_000 && wait <= 8 * 60_000, `wait=${wait}`);
  assert.equal(s.cooldownMs("someone-else"), 0);
  clock.advance(wait + 1);
  assert.equal(s.cooldownMs("u"), 0);
});

test("StrikeTracker memory is bounded", () => {
  const s = new StrikeTracker(5, 60_000, new FakeClock(), 100);
  for (let i = 0; i < 1000; i++) s.record(`u${i}`);
  assert.ok((s as any).hits.size <= 100);
});

test("ModelQuota: per-minute and per-day free-tier guards", () => {
  const clock = new FakeClock();
  const q = new ModelQuota({ rpm: 2, rpd: 5 }, clock);
  assert.equal(q.tryAcquire("m").ok, true);
  assert.equal(q.tryAcquire("m").ok, true);
  const third = q.tryAcquire("m");
  assert.deepEqual([third.ok, third.reason], [false, "rpm"]);
  assert.ok(third.retryAfterMs! > 0);
  assert.equal(q.tryAcquire("other").ok, true, "quotas are per model");
  for (let i = 0; i < 3; i++) { clock.advance(61_000); assert.equal(q.tryAcquire("m").ok, true); }
  clock.advance(61_000);
  assert.equal(q.tryAcquire("m").reason, "rpd");
  clock.advance(24 * 3600_000);
  assert.equal(q.tryAcquire("m").ok, true, "daily counter resets with the Pacific day");
  q.dispose();
});

test("quota day follows Pacific time (Google's RPD reset), including DST", () => {
  assert.equal(quotaDay(new Date("2026-09-30T06:59:00Z")), "2026-09-29"); // 23:59 PDT
  assert.equal(quotaDay(new Date("2026-09-30T07:01:00Z")), "2026-09-30"); // 00:01 PDT
  assert.equal(nextQuotaDayStart(new Date("2026-09-30T06:30:00Z")).toISOString(), "2026-09-30T07:00:00.000Z");
  assert.equal(nextQuotaDayStart(new Date("2026-12-15T05:30:00Z")).toISOString(), "2026-12-15T08:00:00.000Z"); // PST
});
