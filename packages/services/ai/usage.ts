import { AiError } from "./errors";
import { costMicros, type AiConfig, type AiPlanLimits } from "./config";
import type { BudgetSpec, UsageStore, WindowSnapshot } from "./usage-store";
import { humanizeDuration } from "./usage-store";
import { SlidingWindowLimiter, StrikeTracker, systemClock, type Clock } from "./resilience";
import type { AiLogger } from "./logging";
import { quotaDay } from "./quota-day";
import { COOLDOWN_REPLY } from "./guard";

export const FEATURE_FORM_BUILDER = "FORM_BUILDER";

/** Maps a user to the AI engine's plan key ("free" | "pro" | "business"). */
export type PlanResolver = (userId: string) => Promise<string>;

/**
 * Default resolver: everyone is "free". The real one (the user's Paddle subscription → Basic /
 * Premium / Business → free / pro / business) is injected by AiService, which keeps this engine
 * database-free and testable.
 */
export const resolvePlanKey: PlanResolver = async () => "free";

export function planLimits(config: AiConfig, planKey: string): AiPlanLimits {
  return config.plans[planKey] ?? config.plans.free!;
}

/**
 * What the UI shows: credits consumed in the current window. Credits are
 * tokens; the hidden per-window message cap is folded into the same
 * percentage so there is only ever ONE number for the user to understand.
 */
export interface Credits {
  /** 0-100, rounded down — "90% credits consumed". */
  percentUsed: number;
  /** True once the window is exhausted; the user can't send until `resetsAt`. */
  limitReached: boolean;
  /** ISO time the window resets; null when no window is open yet (nothing consumed). */
  resetsAt: string | null;
  tokensUsed: number;
  tokensLimit: number;
}

export function computeCredits(
  limits: Pick<AiPlanLimits, "maxTokensPerWindow" | "maxRequestsPerWindow">,
  used: { tokensUsed: number; requestsUsed: number },
  resetsAt: Date | null,
): Credits {
  const ratio = Math.max(used.tokensUsed / limits.maxTokensPerWindow, used.requestsUsed / limits.maxRequestsPerWindow);
  return {
    percentUsed: Math.max(0, Math.min(100, Math.floor(ratio * 100))),
    limitReached: ratio >= 1,
    resetsAt: resetsAt ? resetsAt.toISOString() : null,
    tokensUsed: Math.max(0, Math.round(used.tokensUsed)),
    tokensLimit: limits.maxTokensPerWindow,
  };
}

export interface Admission {
  userId: string;
  requestId: string;
  planKey: string;
  limits: AiPlanLimits;
  estimatedTokens: number;
  estimatedCostMicros: number;
  window: WindowSnapshot;
  budgetKeys: string[];
  startedAt: number;
}

export interface UsageSummary extends Credits {
  planKey: string;
  windowMs: number;
  maxPromptChars: number;
}

export class UsageService {
  private readonly burst: SlidingWindowLimiter;
  private readonly strikes: StrikeTracker;

  constructor(
    private readonly config: AiConfig,
    private readonly store: UsageStore,
    private readonly logger: AiLogger,
    private readonly clock: Clock = systemClock,
    private readonly planResolver: PlanResolver = resolvePlanKey,
  ) {
    this.burst = new SlidingWindowLimiter(60_000, 50_000, clock);
    this.strikes = new StrikeTracker(config.abuse.offTopicStrikes, config.abuse.offTopicWindowMs, clock);
  }

  resolvePlan(userId: string): Promise<string> {
    return this.planResolver(userId);
  }

  /** Worst case for one request: every input token plus the full output allowance. */
  estimateTokens(estimatedInputTokens: number, maxOutputTokens: number): number {
    return estimatedInputTokens + maxOutputTokens;
  }

  /** Notional (not charged) cost of that worst case, across the most expensive model in the chain. */
  estimateCostMicros(estimatedInputTokens: number, maxOutputTokens: number): number {
    let worst = 0;
    for (const ref of this.config.chain) {
      worst = Math.max(worst, costMicros(this.config, ref.model, estimatedInputTokens, maxOutputTokens));
    }
    return worst;
  }

  /** Cheap in-memory guard against rapid-fire requests. Runs before any DB work or model call. */
  checkBurst(userId: string, limits: AiPlanLimits): void {
    const r = this.burst.check(`u:${userId}`, limits.burstPerMinute);
    if (!r.allowed) {
      throw new AiError("RATE_LIMITED", "Per-user burst limit hit", { retryAfterSec: Math.ceil(r.retryAfterMs / 1000) });
    }
  }

  /** Off-topic / jailbreak attempts: remember them… */
  recordStrike(userId: string): void {
    this.strikes.record(userId);
  }

  /** …and pause the user briefly once they pile up. Never touches the model or the database. */
  assertNotCoolingDown(userId: string): void {
    const ms = this.strikes.cooldownMs(userId);
    if (ms > 0) {
      this.logger.warn("ai.cooldown_active", { userId, seconds: Math.ceil(ms / 1000) });
      throw new AiError("RATE_LIMITED", "Off-topic cool-down", {
        retryAfterSec: Math.ceil(ms / 1000),
        userMessage: `${COOLDOWN_REPLY} (Back in ${humanizeDuration(ms)}.)`,
      });
    }
  }

  async admit(input: {
    userId: string;
    requestId: string;
    formId: string | null;
    prompt: string;
    promptChars: number;
    estimatedInputTokens: number;
  }): Promise<Admission> {
    const planKey = await this.resolvePlan(input.userId);
    const limits = planLimits(this.config, planKey);

    const now = new Date(this.clock.now());
    const estimatedTokens = this.estimateTokens(input.estimatedInputTokens, limits.maxOutputTokens);
    const estimatedCostMicros = this.estimateCostMicros(input.estimatedInputTokens, limits.maxOutputTokens);
    const day = quotaDay(now);

    const budgets: BudgetSpec[] = [
      {
        key: `global:day:${day}`,
        capTokens: this.config.budgets.globalDailyTokens,
        capRequests: this.config.budgets.globalDailyRequests,
        scope: "global",
      },
      { key: `user:${input.userId}:day:${day}`, capTokens: limits.maxTokensPerDay, scope: "user" },
    ];

    let window: WindowSnapshot;
    try {
      window = await this.store.begin({
        userId: input.userId,
        requestId: input.requestId,
        feature: FEATURE_FORM_BUILDER,
        planKey,
        formId: input.formId,
        prompt: input.prompt,
        promptChars: input.promptChars,
        estimatedTokens,
        estimatedCostMicros,
        window: {
          windowMs: limits.windowMs,
          maxRequests: limits.maxRequestsPerWindow,
          maxTokens: limits.maxTokensPerWindow,
        },
        budgets,
        staleAfterMs: this.config.staleRequestMs,
        now,
      });
    } catch (e) {
      if (e instanceof AiError && (e.code === "CAPACITY_REACHED" || e.code === "QUOTA_EXCEEDED")) {
        // Worth knowing about: an enthusiastic user, or the free-tier ceiling about to bite everyone.
        this.logger[e.code === "CAPACITY_REACHED" ? "error" : "info"]("ai.admission_rejected", {
          userId: input.userId,
          requestId: input.requestId,
          code: e.code,
          detail: e.message,
        });
      }
      throw e;
    }

    return {
      userId: input.userId,
      requestId: input.requestId,
      planKey,
      limits,
      estimatedTokens,
      estimatedCostMicros,
      window,
      budgetKeys: budgets.map((b) => b.key),
      startedAt: this.clock.now(),
    };
  }

  async settle(
    admission: Admission,
    result: {
      status: "SUCCEEDED" | "FAILED" | "CANCELLED";
      provider: string | null;
      model: string | null;
      intent: string | null;
      attempts: number;
      fallbackUsed: boolean;
      inputTokens: number;
      outputTokens: number;
      /** Notional cost of the tokens actually used. */
      actualCostMicros: number;
      /** Whether this request should consume one of the user's (hidden) messages. */
      countRequest: boolean;
      firstTokenMs: number | null;
      errorCode: string | null;
    },
  ): Promise<void> {
    const now = this.clock.now();
    try {
      await this.store.settle({
        userId: admission.userId,
        requestId: admission.requestId,
        feature: FEATURE_FORM_BUILDER,
        ...result,
        estimatedTokens: admission.estimatedTokens,
        estimatedCostMicros: admission.estimatedCostMicros,
        latencyMs: now - admission.startedAt,
        windowStart: admission.window.windowStart,
        budgetKeys: admission.budgetKeys,
        creditUnits: admission.window.creditUnits,
        maxRequests: admission.limits.maxRequestsPerWindow,
        maxTokens: admission.limits.maxTokensPerWindow,
        windowMs: admission.limits.windowMs,
        now: new Date(now),
      });
    } catch (e) {
      // Never let a bookkeeping failure break the user's response. The
      // reservation simply stays charged (safe direction) and the row is
      // swept as ABANDONED on the user's next request.
      this.logger.error("ai.settle_failed", {
        userId: admission.userId,
        requestId: admission.requestId,
        message: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      });
    }
  }

  /** Credits as they will stand after a settled request (no extra DB round trip). */
  creditsAfter(admission: Admission, actualTokens: number, counted: boolean): Credits {
    return computeCredits(
      admission.limits,
      {
        tokensUsed: admission.window.tokensUsed + actualTokens,
        requestsUsed: admission.window.requestsUsed - (counted ? 0 : 1),
      },
      admission.window.windowEnd,
    );
  }

  async creditsFor(userId: string): Promise<{ planKey: string; limits: AiPlanLimits; credits: Credits }> {
    const planKey = await this.resolvePlan(userId);
    const limits = planLimits(this.config, planKey);
    const snap = await this.store.snapshot(userId, FEATURE_FORM_BUILDER, new Date(this.clock.now()));
    return {
      planKey,
      limits,
      credits: computeCredits(
        limits,
        { tokensUsed: snap?.tokensUsed ?? 0, requestsUsed: snap?.requestsUsed ?? 0 },
        snap ? snap.windowEnd : null,
      ),
    };
  }

  async summary(userId: string): Promise<UsageSummary> {
    const { planKey, limits, credits } = await this.creditsFor(userId);
    return { ...credits, planKey, windowMs: limits.windowMs, maxPromptChars: limits.maxPromptChars };
  }

  dispose(): void {
    this.burst.dispose();
  }
}
