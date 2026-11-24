import { z } from "zod";

export interface BillingConfig {
  configured: boolean;
  missing: string[];
  environment: "sandbox" | "production";
  apiBaseUrl: string;
  apiKey?: string;
  webhookSecret?: string;
  clientToken?: string;
  prices: { premiumMonthly?: string; premiumYearly?: string };
  graceDays: number;
  webhookToleranceSec: number;
}

const envSchema = z.object({
  PADDLE_ENV: z.enum(["sandbox", "production"]).optional(),
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_CLIENT_TOKEN: z.string().optional(),
  PADDLE_PRICE_ID_PREMIUM_MONTHLY: z.string().optional(),
  PADDLE_PRICE_ID_PREMIUM_YEARLY: z.string().optional(),
  BILLING_GRACE_DAYS: z.coerce.number().int().min(0).max(30).optional(),
  PADDLE_WEBHOOK_TOLERANCE_SEC: z.coerce.number().int().min(5).max(3600).optional(),
});

export function loadBillingConfig(rawEnv: Record<string, string | undefined>): BillingConfig {
  // `FOO=` in a .env file arrives as "" - treat blank exactly like unset.
  const cleaned = Object.fromEntries(
    Object.entries(rawEnv).filter(([, v]) => v !== undefined && v.trim() !== "").map(([k, v]) => [k, v!.trim()]),
  );
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid billing configuration: ${issue?.path.join(".")} — ${issue?.message}`);
  }
  const e = parsed.data;
  const environment = e.PADDLE_ENV ?? "sandbox";

  const required: Array<[string, string | undefined]> = [
    ["PADDLE_API_KEY", e.PADDLE_API_KEY],
    ["PADDLE_WEBHOOK_SECRET", e.PADDLE_WEBHOOK_SECRET],
    ["PADDLE_CLIENT_TOKEN", e.PADDLE_CLIENT_TOKEN],
    ["PADDLE_PRICE_ID_PREMIUM_MONTHLY", e.PADDLE_PRICE_ID_PREMIUM_MONTHLY],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);

  // Catch the classic mix-up early: sandbox keys with production env (or vice versa).
  if (e.PADDLE_CLIENT_TOKEN) {
    const isTest = e.PADDLE_CLIENT_TOKEN.startsWith("test_");
    if (environment === "sandbox" && !isTest) {
      throw new Error("PADDLE_ENV=sandbox but PADDLE_CLIENT_TOKEN is not a sandbox token (expected test_…)");
    }
    if (environment === "production" && isTest) {
      throw new Error("PADDLE_ENV=production but PADDLE_CLIENT_TOKEN is a sandbox token (test_…)");
    }
  }

  return {
    configured: missing.length === 0,
    missing,
    environment,
    apiBaseUrl: environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com",
    apiKey: e.PADDLE_API_KEY,
    webhookSecret: e.PADDLE_WEBHOOK_SECRET,
    clientToken: e.PADDLE_CLIENT_TOKEN,
    prices: { premiumMonthly: e.PADDLE_PRICE_ID_PREMIUM_MONTHLY, premiumYearly: e.PADDLE_PRICE_ID_PREMIUM_YEARLY },
    graceDays: e.BILLING_GRACE_DAYS ?? 7,
    webhookToleranceSec: e.PADDLE_WEBHOOK_TOLERANCE_SEC ?? 300,
  };
}

let cached: BillingConfig | null = null;
export function getBillingConfig(): BillingConfig {
  if (!cached) cached = loadBillingConfig(process.env);
  return cached;
}
