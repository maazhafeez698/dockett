import { AiError } from "./errors";
import { nextQuotaDayStart } from "./quota-day";

export interface BudgetSpec {
  // Namespaced counter key, e.g. "global:day:2026-09-30". 
  key: string;
  capTokens: number;
  // Optional request-count ceiling (used for Google's requests-per-day quota). 
  capRequests?: number;
  // Decides which error a breach produces: global → "at capacity", user → "limit reached". 
  scope: "global" | "user";
}

export interface WindowLimits {
  windowMs: number;
  maxRequests: number;
  maxTokens: number;
}

export interface WindowSnapshot {
  windowStart: Date;
  windowEnd: Date | null;
  requestsUsed: number;
  tokensUsed: number;
  creditsUsed: number;
  creditUnits: number;
}

export interface BeginInput {
  userId: string;
  requestId: string;
  feature: string;
  planKey: string;
  formId: string | null;
  promptChars: number;
  prompt: string;
  estimatedTokens: number;
  estimatedCostMicros: number;
  window: WindowLimits;
  budgets: BudgetSpec[];
  staleAfterMs: number;
  now: Date;
}

export interface SettleInput {
  userId: string;
  requestId: string;
  feature: string;
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  provider: string | null;
  model: string | null;
  intent: string | null;
  attempts: number;
  fallbackUsed: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedTokens: number;
  estimatedCostMicros: number;
  actualCostMicros: number;
  countRequest: boolean;
  latencyMs: number;
  firstTokenMs: number | null;
  errorCode: string | null;
  windowStart: Date;
  budgetKeys: string[];
  creditUnits: number;
  maxRequests: number;
  maxTokens: number;
  windowMs: number;
  now: Date;
}

export interface UsageStore {
  begin(input: BeginInput): Promise<WindowSnapshot>;
  settle(input: SettleInput): Promise<void>;
  // Current window without reserving anything; null if there is no live window. 
  snapshot(userId: string, feature: string, now: Date): Promise<WindowSnapshot | null>;
}

export function quotaError(kind: "window" | "daily", resetsAt: Date, now: Date): AiError {
  const retryAfterSec = Math.max(1, Math.ceil((resetsAt.getTime() - now.getTime()) / 1000));
  return new AiError("QUOTA_EXCEEDED", `Credits exhausted (${kind})`, {
    retryAfterSec,
    details: { kind, resetsAt: resetsAt.toISOString() },
    userMessage:
      kind === "daily"
        ? `Limit reached for today. Your credits are back in ${humanizeDuration(retryAfterSec * 1000)}.`
        : `Limit reached. Your credits reset in ${humanizeDuration(retryAfterSec * 1000)}.`,
  });
}

export function humanizeDuration(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return m === 0 ? `${h} hour${h === 1 ? "" : "s"}` : `${h}h ${m}m`;
}

// Whether a budget would be breached by reserving `tokens` and one request. 
export function breaches(b: BudgetSpec, current: { tokens: number; requests: number }, tokens: number): boolean {
  if (tokens > b.capTokens) return true;
  if (current.tokens + tokens > b.capTokens) return true;
  if (b.capRequests !== undefined && current.requests + 1 > b.capRequests) return true;
  return false;
}

export function budgetError(b: BudgetSpec, now: Date): AiError {
  return b.scope === "user"
    ? quotaError("daily", nextQuotaDayStart(now), now)
    : new AiError("CAPACITY_REACHED", `Budget exhausted: ${b.key}`, {
        retryAfterSec: Math.max(60, Math.ceil((nextQuotaDayStart(now).getTime() - now.getTime()) / 1000)),
      });
}


interface MemRequest {
  userId: string;
  requestId: string;
  status: "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "ABANDONED";
  createdAt: number;
}
interface MemWindow {
  start: number;
  end: number | null;
  requests: number;
  tokens: number;
  credits: number;
  cost: number;
}

const CREDIT_SCALE = 10_000;

// Assign a small, prompt-dependent variation while keeping 20 messages at exactly 100%. 
export function messageCreditUnits(
  prompt: string,
  requestIndex: number,
  maxRequests: number,
  creditsUsed: number,
): number {
  const remaining = Math.max(0, CREDIT_SCALE - creditsUsed);
  if (requestIndex >= maxRequests) return remaining;

  const base = Math.floor(CREDIT_SCALE / maxRequests);
  const maxJitter = Math.min(200, Math.floor(base * 0.4));
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const desiredJitter = (Math.abs(hash) % 5 - 2) * 100;
  const deviation = creditsUsed - base * (requestIndex - 1);
  const lower = Math.max(-maxJitter, -maxJitter - deviation);
  const upper = Math.min(maxJitter, maxJitter - deviation);
  const jitter = Math.max(lower, Math.min(upper, desiredJitter));
  return Math.min(remaining, Math.max(1, base + jitter));
}

export class MemoryUsageStore implements UsageStore {
  readonly requests: MemRequest[] = [];
  readonly windows = new Map<string, MemWindow>();
  readonly counters = new Map<string, { tokens: number; requests: number; cost: number }>();

  private wkey = (u: string, f: string) => `${u}|${f}`;

  async begin(i: BeginInput): Promise<WindowSnapshot> {
    const now = i.now.getTime();

    for (const r of this.requests) {
      if (r.userId === i.userId && r.status === "IN_PROGRESS" && r.createdAt < now - i.staleAfterMs) {
        r.status = "ABANDONED";
      }
    }

    const same = this.requests.find((r) => r.userId === i.userId && r.requestId === i.requestId);
    if (same) throw new AiError(same.status === "IN_PROGRESS" ? "REQUEST_IN_PROGRESS" : "DUPLICATE_REQUEST");
    if (this.requests.some((r) => r.userId === i.userId && r.status === "IN_PROGRESS")) {
      throw new AiError("REQUEST_IN_PROGRESS");
    }

    // Compute everything first, commit only if every check passes (atomicity).
    const key = this.wkey(i.userId, i.feature);
    const cur = this.windows.get(key);
    const expired = cur?.end !== null && cur?.end !== undefined && now >= cur.end;
    const w: MemWindow = cur && !expired
      ? { ...cur }
      : { start: now, end: null, requests: 0, tokens: 0, credits: 0, cost: 0 };

    if (w.requests >= i.window.maxRequests || w.tokens >= i.window.maxTokens || w.credits >= CREDIT_SCALE) {
      throw quotaError("window", new Date(w.end ?? now + i.window.windowMs), i.now);
    }

    for (const b of i.budgets) {
      const c = this.counters.get(b.key) ?? { tokens: 0, requests: 0, cost: 0 };
      if (breaches(b, c, i.estimatedTokens)) throw budgetError(b, i.now);
    }

    const creditUnits = messageCreditUnits(i.prompt, w.requests + 1, i.window.maxRequests, w.credits);
    w.requests += 1;
    w.credits += creditUnits;
    if (w.credits >= CREDIT_SCALE || w.tokens >= i.window.maxTokens) w.end = now + i.window.windowMs;
    this.windows.set(key, w);
    for (const b of i.budgets) {
      const c = this.counters.get(b.key) ?? { tokens: 0, requests: 0, cost: 0 };
      this.counters.set(b.key, { ...c, tokens: c.tokens + i.estimatedTokens, requests: c.requests + 1 });
    }
    this.requests.push({ userId: i.userId, requestId: i.requestId, status: "IN_PROGRESS", createdAt: now });

    return {
      windowStart: new Date(w.start),
      windowEnd: w.end === null ? null : new Date(w.end),
      requestsUsed: w.requests,
      tokensUsed: w.tokens,
      creditsUsed: w.credits,
      creditUnits,
    };
  }

  async settle(i: SettleInput): Promise<void> {
    const req = this.requests.find((r) => r.userId === i.userId && r.requestId === i.requestId);
    if (!req || req.status !== "IN_PROGRESS") return; // already swept; its reservation stays charged
    req.status = i.status;

    const actualTokens = i.inputTokens + i.outputTokens;
    const refund = i.countRequest ? 0 : 1;
    const w = this.windows.get(this.wkey(i.userId, i.feature));
    if (w && w.start === i.windowStart.getTime()) {
      w.requests = Math.max(0, w.requests - refund);
      if (!i.countRequest) w.credits = Math.max(0, w.credits - i.creditUnits);
      w.tokens += actualTokens;
      w.cost += i.actualCostMicros;
      const reached = w.requests >= i.maxRequests || w.tokens >= i.maxTokens || w.credits >= CREDIT_SCALE;
      w.end = reached ? (w.end ?? i.now.getTime() + i.windowMs) : null;
    }
    for (const k of i.budgetKeys) {
      const c = this.counters.get(k);
      if (c) {
        this.counters.set(k, {
          tokens: Math.max(0, c.tokens + actualTokens - i.estimatedTokens),
          requests: Math.max(0, c.requests - refund),
          cost: c.cost + i.actualCostMicros,
        });
      }
    }
  }

  async snapshot(userId: string, feature: string, now: Date): Promise<WindowSnapshot | null> {
    const w = this.windows.get(this.wkey(userId, feature));
    if (!w || (w.end !== null && now.getTime() >= w.end)) return null;
    return {
      windowStart: new Date(w.start),
      windowEnd: w.end === null ? null : new Date(w.end),
      requestsUsed: w.requests,
      tokensUsed: w.tokens,
      creditsUsed: w.credits,
      creditUnits: 0,
    };
  }
}
