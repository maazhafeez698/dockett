import { test } from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker, SlidingWindowLimiter, backoffDelay } from "../resilience";
import { FakeClock } from "./helpers";

test("breaker opens after N failures in window, half-opens after cooldown, closes on success", () => {
  const clock = new FakeClock();
  const b = new CircuitBreaker({ failureThreshold: 3, windowMs: 60_000, cooldownMs: 30_000 }, clock);
  assert.equal(b.recordFailure("m"), false);
  assert.equal(b.recordFailure("m"), false);
  assert.equal(b.isOpen("m"), false);
  assert.equal(b.recordFailure("m"), true);
  assert.equal(b.isOpen("m"), true);
  assert.equal(b.isOpen("other"), false);
  clock.advance(30_001);
  assert.equal(b.isOpen("m"), false);
  b.recordSuccess("m");
  b.recordFailure("m");
  assert.equal(b.isOpen("m"), false);
});

test("breaker ignores failures older than the window", () => {
  const clock = new FakeClock();
  const b = new CircuitBreaker({ failureThreshold: 2, windowMs: 1000, cooldownMs: 5000 }, clock);
  b.recordFailure("m");
  clock.advance(1500);
  assert.equal(b.recordFailure("m"), false);
  assert.equal(b.isOpen("m"), false);
});

test("sliding window limiter allows N then blocks with an accurate retry-after", () => {
  const clock = new FakeClock();
  const l = new SlidingWindowLimiter(60_000, 100, clock);
  for (let i = 0; i < 3; i++) assert.equal(l.check("k", 3).allowed, true);
  clock.advance(10_000);
  const blocked = l.check("k", 3);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 50_000);
  assert.equal(l.check("other", 3).allowed, true);
  clock.advance(50_001);
  assert.equal(l.check("k", 3).allowed, true);
  l.dispose();
});

test("limiter memory is bounded under a flood of unique keys", () => {
  const l = new SlidingWindowLimiter(60_000, 1000, new FakeClock());
  for (let i = 0; i < 20_000; i++) l.check(`ip${i}`, 5);
  assert.ok((l as any).hits.size <= 1000);
  l.dispose();
});

test("backoff is exponential, capped, and jittered within bounds", () => {
  assert.equal(backoffDelay(0, 100, 1000, () => 0.999), 99);
  assert.equal(backoffDelay(3, 100, 1000, () => 0.999), 799);
  assert.equal(backoffDelay(10, 100, 1000, () => 0.999), 999);
  assert.equal(backoffDelay(2, 100, 1000, () => 0), 0);
});
