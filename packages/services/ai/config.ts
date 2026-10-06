import { z } from "zod";

/**
 * Everything tunable about the AI feature lives here and is driven by
 * environment variables — model choice, fallback order, limits, timeouts.
 * Changing any of it is a config change, never a code change.
 *
 * FREE TIER ONLY: this build talks to the Gemini API's free tier and nothing
 * else. There is no paid provider in the code, and `AI_MODEL_CHAIN` is
 * checked against the Flash / Flash-Lite families (Pro, image, audio and
 * embedding models have no free tier and are rejected at startup). The real
 * guarantee is on Google's side: use an API key from a Google Cloud project
 * that has NO billing account attached — then Google cannot charge you, it
 * can only answer 429 when a free quota is used up (which this code handles).
 *
 * `loadAiConfig` is a pure function of an env object so it can be tested
 * without touching process.env.
 */

export type ProviderId = "gemini";

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export interface ModelPricing {
  /** USD per 1M input tokens. Numerically equal to micro-USD per token. */
  inPerM: number;
  /** USD per 1M output tokens (thinking tokens bill as output). */
  outPerM: number;
}

/**
 * Everything that can differ between subscription tiers. Phase 7 will map a
 * user's plan to one of these via `resolvePlanKey` (see usage.ts) — nothing
 * else in the AI code needs to change when that happens.
 *
 * Credits are measured in TOKENS (input + output), like other LLM products.
 * `maxRequestsPerWindow` stays as a second, hidden guard behind the scenes.
 */
export interface AiPlanLimits {
  /** Length of one credit window ("session"). */
  windowMs: number;
  maxRequestsPerWindow: number;
  maxTokensPerWindow: number;
  maxTokensPerDay: number;
  /** Per-message cap on what the user types. */
  maxPromptChars: number;
  /** How many prior chat messages are sent to the model as context. */
  maxHistoryMessages: number;
  maxOutputTokens: number;
  maxFieldsPerForm: number;
  /** Short-term burst guard (requests per rolling minute). */
  burstPerMinute: number;
}

export interface AiConfig {
  enabled: boolean;
  /** Why AI is off, when it is (for logs / health checks). */
  disabledReason?: string;
  providers: { gemini?: { apiKey: string; baseUrl: string } };
  chain: ModelRef[];
  /** Used only for *notional* cost reporting / future billing — the free tier charges nothing. */
  pricing: Record<string, ModelPricing>;
  defaultPricing: ModelPricing;
  temperature: number;
  geminiThinkingLevel?: string;
  timeouts: {
    firstByteMs: number;
    idleMs: number;
    attemptMs: number;
    totalMs: number;
  };
  retry: {
    maxAttempts: number;
    sameModelRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  breaker: { failureThreshold: number; windowMs: number; cooldownMs: number };
  /** Client-side guards that keep us under Google's free-tier per-model quotas. */
  freeTier: { rpmPerModel: number; rpdPerModel: number };
  /** App-wide daily ceilings (Pacific-time day, matching Google's RPD reset). */
  budgets: { globalDailyRequests: number; globalDailyTokens: number };
  ipLimit: { perMinute: number };
  /** Off-topic / abuse strikes before a short cool-down. */
  abuse: { offTopicStrikes: number; offTopicWindowMs: number };
  /** An IN_PROGRESS row older than this is considered dead (crashed server). */
  staleRequestMs: number;
  plans: Record<string, AiPlanLimits>;
}

// Notional prices (USD / 1M tokens) so usage can be reported in dollars if
// billing is ever added. Nothing here is charged on the free tier.
export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "gemini-3.1-flash-lite": { inPerM: 0.25, outPerM: 1.5 },
  "gemini-3.5-flash-lite": { inPerM: 0.3, outPerM: 2.5 },
  "gemini-2.5-flash-lite": { inPerM: 0.1, outPerM: 0.4 },
  "gemini-3.6-flash": { inPerM: 0.75, outPerM: 3.75 },
  "gemini-3.7-flash": { inPerM: 0.75, outPerM: 3.75 },
  "gemini-3.8-flash": { inPerM: 0.75, outPerM: 3.75 },
};

/** Primary first. Both are Flash-Lite (largest free quotas) and each has its own per-model quota. */
export const DEFAULT_CHAIN = "gemini:gemini-3.5-flash-lite,gemini:gemini-3.1-flash-lite";

const FREE_FAMILY = /^gemini-[0-9]+(\.[0-9]+)?-flash(-lite)?(-preview)?$/;
const NEVER_FREE = /(pro|image|tts|live|embedding|veo|imagen|omni|computer-use|deep-research|audio|native)/;

/** True when the model id belongs to a family that has a Gemini API free tier. */
export function isFreeTierModel(model: string, extraAllowed: ReadonlySet<string> = new Set()): boolean {
  if (extraAllowed.has(model)) return true;
  return FREE_FAMILY.test(model) && !NEVER_FREE.test(model);
}

const envSchema = z.object({
  AI_ENABLED: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_BASE_URL: z.string().optional(),

  AI_MODEL_CHAIN: z.string().optional(),
  AI_EXTRA_FREE_MODELS: z.string().optional(),
  AI_MODEL_PRICING_JSON: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1.5).optional(),
  AI_GEMINI_THINKING_LEVEL: z.string().optional(),

  AI_FIRST_BYTE_TIMEOUT_MS: z.coerce.number().int().min(1).optional(),
  AI_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1).optional(),
  AI_ATTEMPT_TIMEOUT_MS: z.coerce.number().int().min(1).optional(),
  AI_TOTAL_TIMEOUT_MS: z.coerce.number().int().min(1).optional(),
  AI_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(6).optional(),
  AI_SAME_MODEL_RETRIES: z.coerce.number().int().min(0).max(2).optional(),
  AI_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).optional(),
  AI_RETRY_MAX_DELAY_MS: z.coerce.number().int().min(0).optional(),
  AI_BREAKER_FAILURES: z.coerce.number().int().min(1).optional(),
  AI_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1).optional(),

  AI_MODEL_RPM: z.coerce.number().int().min(1).optional(),
  AI_MODEL_RPD: z.coerce.number().int().min(1).optional(),
  AI_DAILY_REQUEST_BUDGET: z.coerce.number().int().min(1).optional(),
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(1).optional(),
  AI_IP_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  AI_OFFTOPIC_STRIKES: z.coerce.number().int().min(1).optional(),
  AI_OFFTOPIC_WINDOW_MINUTES: z.coerce.number().min(1).optional(),

  AI_WINDOW_MINUTES: z.coerce.number().min(1).optional(),
  AI_FREE_MAX_REQUESTS: z.coerce.number().int().min(1).optional(),
  AI_FREE_MAX_TOKENS: z.coerce.number().int().min(1000).optional(),
  AI_FREE_MAX_DAILY_TOKENS: z.coerce.number().int().min(1000).optional(),
  AI_PLANS_JSON: z.string().optional(),
});

const planOverrideSchema = z.object({
  windowMs: z.number().int().positive().optional(),
  maxRequestsPerWindow: z.number().int().positive().optional(),
  maxTokensPerWindow: z.number().int().min(1000).optional(),
  maxTokensPerDay: z.number().int().min(1000).optional(),
  maxPromptChars: z.number().int().positive().max(20_000).optional(),
  maxHistoryMessages: z.number().int().min(0).max(40).optional(),
  maxOutputTokens: z.number().int().min(256).max(16_000).optional(),
  maxFieldsPerForm: z.number().int().positive().max(100).optional(),
  burstPerMinute: z.number().int().positive().optional(),
});

function parseJsonEnv<T>(name: string, raw: string | undefined, schema: z.ZodType<T>): T | undefined {
  if (!raw || !raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${name} is invalid: ${result.error.issues[0]?.message ?? "bad shape"}`);
  }
  return result.data;
}

/** Accepts "gemini:model" or a bare "model" (always Gemini). */
export function parseModelChain(raw: string, extraAllowed: ReadonlySet<string> = new Set()): ModelRef[] {
  const refs: ModelRef[] = [];
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const idx = entry.indexOf(":");
    let model = entry;
    if (idx !== -1) {
      const provider = entry.slice(0, idx).trim().toLowerCase();
      if (provider !== "gemini") {
        throw new Error(
          `AI_MODEL_CHAIN provider "${provider}" is not supported — this build is Gemini free-tier only (use gemini:<model>)`,
        );
      }
      model = entry.slice(idx + 1).trim();
    }
    if (!model || !/^[A-Za-z0-9._\-]+$/.test(model)) {
      throw new Error(`AI_MODEL_CHAIN model "${model}" is missing or contains invalid characters`);
    }
    if (!isFreeTierModel(model, extraAllowed)) {
      throw new Error(
        `AI_MODEL_CHAIN model "${model}" is not a Gemini free-tier model (Flash / Flash-Lite only). ` +
          `If Google added a new free model, list it in AI_EXTRA_FREE_MODELS.`,
      );
    }
    refs.push({ provider: "gemini", model });
  }
  return refs;
}

export function defaultPlans(windowMs: number, free: Partial<AiPlanLimits>): Record<string, AiPlanLimits> {
  const freePlan: AiPlanLimits = {
    windowMs,
    maxRequestsPerWindow: 20, // hidden guard: ~15 normal messages fit comfortably
    maxTokensPerWindow: 60_000, // ≈ 20 typical messages; this is what users see as "credits"
    maxTokensPerDay: 150_000,
    maxPromptChars: 2000,
    maxHistoryMessages: 8,
    maxOutputTokens: 3500,
    maxFieldsPerForm: 30,
    burstPerMinute: 6,
    ...free,
  };
  return {
    free: freePlan,
    // Plan keys here are the AI engine's own: free ↔ Basic, pro ↔ Premium, business ↔ Business.
    // Which user gets which is decided by their subscription (packages/services/billing/plans.ts).
    pro: {
      ...freePlan,
      maxRequestsPerWindow: 100,
      maxTokensPerWindow: 400_000,
      maxTokensPerDay: 1_000_000,
      maxPromptChars: 4000,
      maxHistoryMessages: 12,
      maxFieldsPerForm: 60,
      burstPerMinute: 12,
    },
    // Business ("Unlimited everything"): the same engine, with ceilings high enough that no normal
    // team meets them. Still finite on purpose — the AI runs on a shared Gemini quota.
    business: {
      ...freePlan,
      maxRequestsPerWindow: 300,
      maxTokensPerWindow: 1_200_000,
      maxTokensPerDay: 3_000_000,
      maxPromptChars: 6000,
      maxHistoryMessages: 16,
      maxFieldsPerForm: 100,
      burstPerMinute: 20,
    },
  };
}

export function loadAiConfig(rawEnv: Record<string, string | undefined>): AiConfig {
  // `FOO=` in a .env file arrives as "" — treat blank exactly like unset.
  const cleaned = Object.fromEntries(Object.entries(rawEnv).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid AI configuration: ${issue?.path.join(".")} — ${issue?.message}`);
  }
  const e = parsed.data;

  const flagOn = !["false", "0", "off", "no"].includes((e.AI_ENABLED ?? "true").trim().toLowerCase());

  const providers: AiConfig["providers"] = {};
  if (e.GEMINI_API_KEY?.trim()) {
    providers.gemini = {
      apiKey: e.GEMINI_API_KEY.trim(),
      baseUrl: (e.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, ""),
    };
  }

  const extraAllowed = new Set((e.AI_EXTRA_FREE_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean));
  const chain = parseModelChain(e.AI_MODEL_CHAIN?.trim() || DEFAULT_CHAIN, extraAllowed);

  const pricingOverrides =
    parseJsonEnv(
      "AI_MODEL_PRICING_JSON",
      e.AI_MODEL_PRICING_JSON,
      z.record(z.string(), z.object({ in: z.number().nonnegative(), out: z.number().nonnegative() })),
    ) ?? {};
  const pricing: Record<string, ModelPricing> = { ...DEFAULT_PRICING };
  for (const [model, p] of Object.entries(pricingOverrides)) pricing[model] = { inPerM: p.in, outPerM: p.out };

  const windowMs = Math.round((e.AI_WINDOW_MINUTES ?? 300) * 60_000);
  const plans = defaultPlans(windowMs, {
    ...(e.AI_FREE_MAX_REQUESTS ? { maxRequestsPerWindow: e.AI_FREE_MAX_REQUESTS } : {}),
    ...(e.AI_FREE_MAX_TOKENS ? { maxTokensPerWindow: e.AI_FREE_MAX_TOKENS } : {}),
    ...(e.AI_FREE_MAX_DAILY_TOKENS ? { maxTokensPerDay: e.AI_FREE_MAX_DAILY_TOKENS } : {}),
  });

  const planOverrides = parseJsonEnv("AI_PLANS_JSON", e.AI_PLANS_JSON, z.record(z.string(), planOverrideSchema)) ?? {};
  for (const [key, override] of Object.entries(planOverrides)) {
    const base = plans[key] ?? plans.free!;
    plans[key] = { ...base, ...stripUndefined(override) };
  }

  let disabledReason: string | undefined;
  if (!flagOn) disabledReason = "AI_ENABLED is off";
  else if (!providers.gemini) disabledReason = "GEMINI_API_KEY is not set";
  else if (chain.length === 0) disabledReason = "AI_MODEL_CHAIN is empty";

  return {
    enabled: disabledReason === undefined,
    disabledReason,
    providers,
    chain,
    pricing,
    defaultPricing: { inPerM: 1, outPerM: 5 },
    temperature: e.AI_TEMPERATURE ?? 0.7,
    geminiThinkingLevel:
      e.AI_GEMINI_THINKING_LEVEL && e.AI_GEMINI_THINKING_LEVEL.trim().toLowerCase() !== "default"
        ? e.AI_GEMINI_THINKING_LEVEL.trim().toLowerCase()
        : undefined,
    timeouts: {
      firstByteMs: e.AI_FIRST_BYTE_TIMEOUT_MS ?? 20_000,
      idleMs: e.AI_IDLE_TIMEOUT_MS ?? 15_000,
      attemptMs: e.AI_ATTEMPT_TIMEOUT_MS ?? 45_000,
      totalMs: e.AI_TOTAL_TIMEOUT_MS ?? 75_000,
    },
    retry: {
      maxAttempts: e.AI_MAX_ATTEMPTS ?? 3,
      sameModelRetries: e.AI_SAME_MODEL_RETRIES ?? 1,
      baseDelayMs: e.AI_RETRY_BASE_DELAY_MS ?? 400,
      maxDelayMs: e.AI_RETRY_MAX_DELAY_MS ?? 4_000,
    },
    breaker: {
      failureThreshold: e.AI_BREAKER_FAILURES ?? 5,
      windowMs: 60_000,
      cooldownMs: e.AI_BREAKER_COOLDOWN_MS ?? 30_000,
    },
    // Deliberately below typical free-tier numbers (≈10-15 RPM, ≈500 RPD for Flash-Lite;
    // Google's AI Studio shows the exact figures for YOUR project).
    freeTier: { rpmPerModel: e.AI_MODEL_RPM ?? 10, rpdPerModel: e.AI_MODEL_RPD ?? 450 },
    budgets: {
      globalDailyRequests: e.AI_DAILY_REQUEST_BUDGET ?? 900,
      globalDailyTokens: e.AI_DAILY_TOKEN_BUDGET ?? 2_500_000,
    },
    ipLimit: { perMinute: e.AI_IP_LIMIT_PER_MINUTE ?? 120 },
    abuse: {
      offTopicStrikes: e.AI_OFFTOPIC_STRIKES ?? 5,
      offTopicWindowMs: Math.round((e.AI_OFFTOPIC_WINDOW_MINUTES ?? 10) * 60_000),
    },
    // Must exceed totalMs so a slow-but-alive request is never swept as dead.
    staleRequestMs: (e.AI_TOTAL_TIMEOUT_MS ?? 75_000) + 45_000,
    plans,
  };
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function pricingFor(config: AiConfig, model: string): ModelPricing {
  return config.pricing[model] ?? config.defaultPricing;
}

/** NOTIONAL cost in integer micro-USD ($/1M tokens == micro-USD/token). Not charged on the free tier. */
export function costMicros(config: AiConfig, model: string, inputTokens: number, outputTokens: number): number {
  const p = pricingFor(config, model);
  return Math.ceil(inputTokens * p.inPerM + outputTokens * p.outPerM);
}

let cached: AiConfig | null = null;

/** Lazily reads process.env once. Throws a clear error if the env is malformed. */
export function getAiConfig(): AiConfig {
  if (!cached) cached = loadAiConfig(process.env);
  return cached;
}
