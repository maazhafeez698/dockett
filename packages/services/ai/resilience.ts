import { quotaDay } from "./quota-day";

export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };


interface BreakerState {
  failures: number[];
  openUntil: number;
}

export class CircuitBreaker {
  private readonly states = new Map<string, BreakerState>();

  constructor(
    private readonly opts: { failureThreshold: number; windowMs: number; cooldownMs: number },
    private readonly clock: Clock = systemClock,
  ) {}

  isOpen(key: string): boolean {
    const s = this.states.get(key);
    return !!s && s.openUntil > this.clock.now();
  }

  recordFailure(key: string): boolean {
    const now = this.clock.now();
    const s = this.states.get(key) ?? { failures: [], openUntil: 0 };
    s.failures = s.failures.filter((t) => now - t < this.opts.windowMs);
    s.failures.push(now);
    let opened = false;
    if (s.failures.length >= this.opts.failureThreshold) {
      s.openUntil = now + this.opts.cooldownMs;
      s.failures = [];
      opened = true;
    }
    this.states.set(key, s);
    return opened;
  }

  recordSuccess(key: string): void {
    this.states.delete(key);
  }
}


export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
    private readonly clock: Clock = systemClock,
  ) {
    this.sweeper = setInterval(() => this.sweep(), Math.max(windowMs, 30_000));
    this.sweeper.unref?.();
  }

  check(key: string, limit: number): RateLimitResult {
    const now = this.clock.now();
    const cutoff = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (arr.length >= limit) {
      this.hits.set(key, arr);
      const oldest = arr[0] ?? now;
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(oldest + this.windowMs - now, 1) };
    }

    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) this.sweep(true);
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true, remaining: limit - arr.length, retryAfterMs: 0 };
  }

  private sweep(force = false): void {
    const cutoff = this.clock.now() - this.windowMs;
    for (const [k, arr] of this.hits) {
      if (!arr.length || arr[arr.length - 1]! <= cutoff) this.hits.delete(k);
    }
    if (force && this.hits.size >= this.maxKeys) {
      // Still full of live keys: drop the oldest quarter rather than grow.
      let n = Math.ceil(this.maxKeys / 4);
      for (const k of this.hits.keys()) {
        this.hits.delete(k);
        if (--n <= 0) break;
      }
    }
  }

  dispose(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }
}

export interface ModelQuotaDecision {
  ok: boolean;
  reason?: "rpm" | "rpd";
  retryAfterMs?: number;
}

export class ModelQuota {
  private readonly minute: SlidingWindowLimiter;
  private readonly daily = new Map<string, { day: string; count: number }>();

  constructor(
    private readonly limits: { rpm: number; rpd: number },
    private readonly clock: Clock = systemClock,
  ) {
    this.minute = new SlidingWindowLimiter(60_000, 1000, clock);
  }

  // Reserve one call on `model` if both quotas allow it. 
  tryAcquire(model: string): ModelQuotaDecision {
    const day = quotaDay(new Date(this.clock.now()));
    const d = this.daily.get(model);
    const count = d && d.day === day ? d.count : 0;
    if (count >= this.limits.rpd) return { ok: false, reason: "rpd" };

    const r = this.minute.check(model, this.limits.rpm);
    if (!r.allowed) return { ok: false, reason: "rpm", retryAfterMs: r.retryAfterMs };

    this.daily.set(model, { day, count: count + 1 });
    return { ok: true };
  }

  dispose(): void {
    this.minute.dispose();
  }
}

export class StrikeTracker {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock = systemClock,
    private readonly maxKeys = 50_000,
  ) {}

  private live(key: string): number[] {
    const cutoff = this.clock.now() - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length) this.hits.set(key, arr);
    else this.hits.delete(key);
    return arr;
  }

  record(key: string): void {
    const arr = this.live(key);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      const first = this.hits.keys().next().value;
      if (first !== undefined) this.hits.delete(first);
    }
    arr.push(this.clock.now());
    this.hits.set(key, arr);
  }

  // Milliseconds until the user may talk to the model again; 0 if not paused. 
  cooldownMs(key: string): number {
    const arr = this.live(key);
    if (arr.length < this.limit) return 0;
    // They may continue once enough old strikes expire to drop below the limit.
    const releaseAt = arr[arr.length - this.limit]! + this.windowMs;
    return Math.max(0, releaseAt - this.clock.now());
  }
}


// Exponential backoff with full jitter: random in [0, min(max, base·2^attempt)]. 
export function backoffDelay(attemptIndex: number, baseMs: number, maxMs: number, rand: () => number = Math.random): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attemptIndex);
  return Math.floor(rand() * ceiling);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
