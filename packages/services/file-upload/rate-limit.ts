// packages/services/file-upload/rate-limit.ts
//
// A small in-memory sliding-window limiter. It protects a single API instance cheaply; the
// database-backed caps in the upload service (pending uploads per visitor, per form, per owner)
// are the cross-instance backstop.

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Hard cap on tracked keys so a flood of distinct keys can't grow memory without bound. */
    private readonly maxKeys = 20_000,
  ) {}

  /** Records an attempt and says whether it is allowed. */
  public hit(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    const since = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);

    if (list.length >= this.limit) {
      this.hits.set(key, list);
      const retryAfterSec = Math.max(1, Math.ceil((list[0]! + this.windowMs - now) / 1000));
      return { ok: false, retryAfterSec };
    }

    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > this.maxKeys) this.prune(now);
    return { ok: true, retryAfterSec: 0 };
  }

  public prune(now = Date.now()) {
    const since = now - this.windowMs;
    for (const [key, list] of this.hits) {
      const kept = list.filter((t) => t > since);
      if (kept.length === 0) this.hits.delete(key);
      else this.hits.set(key, kept);
    }
    // Still too many distinct keys: drop the oldest ones.
    if (this.hits.size > this.maxKeys) {
      const overflow = this.hits.size - this.maxKeys;
      let i = 0;
      for (const key of this.hits.keys()) {
        if (i++ >= overflow) break;
        this.hits.delete(key);
      }
    }
  }

  public get size() {
    return this.hits.size;
  }
}
