import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAiConfig, parseModelChain, costMicros, isFreeTierModel } from "../config";
import { testConfig } from "./helpers";

test("defaults: a Gemini key yields two FREE Flash-Lite models, a 5h window and ~20 messages of tokens", () => {
  const c = loadAiConfig({ GEMINI_API_KEY: "k" });
  assert.equal(c.enabled, true);
  assert.deepEqual(c.chain.map((x) => x.model), ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]);
  assert.equal(c.plans.free!.windowMs, 5 * 60 * 60 * 1000);
  assert.ok(c.plans.free!.maxRequestsPerWindow >= 15);
  assert.equal(c.plans.free!.maxTokensPerWindow, 60_000);
});

test("no API key → AI disabled with a reason (not a crash)", () => {
  const c = loadAiConfig({});
  assert.equal(c.enabled, false);
  assert.match(c.disabledReason!, /GEMINI_API_KEY/);
});

test("AI_ENABLED=false is a kill switch", () => {
  assert.equal(loadAiConfig({ GEMINI_API_KEY: "k", AI_ENABLED: "false" }).enabled, false);
  assert.equal(loadAiConfig({ GEMINI_API_KEY: "k", AI_ENABLED: "off" }).enabled, false);
});

test("blank env values behave like unset (.env files often contain 'KEY=')", () => {
  const c = loadAiConfig({ GEMINI_API_KEY: "k", AI_MODEL_CHAIN: "", AI_DAILY_REQUEST_BUDGET: "", AI_WINDOW_MINUTES: "  " });
  assert.equal(c.enabled, true);
  assert.equal(c.budgets.globalDailyRequests, 900);
});

test("models can be swapped purely by config; bare ids and gemini: prefixes both work", () => {
  const c = loadAiConfig({ GEMINI_API_KEY: "g", AI_MODEL_CHAIN: "gemini-3.1-flash-lite, gemini:gemini-3.5-flash-lite" });
  assert.deepEqual(c.chain.map((x) => x.model), ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);
});

test("FREE TIER ONLY: paid-only models and other providers are rejected at startup", () => {
  for (const bad of ["gemini-3.1-pro", "gemini-3-pro-preview", "gemini-3.1-flash-image", "gemini-2.5-flash-preview-tts", "gemini-embedding-001", "gpt-5-mini"]) {
    assert.throws(() => parseModelChain(bad), /free-tier/i, bad);
  }
  assert.throws(() => parseModelChain("openai:gpt-5-mini"), /Gemini free-tier only/);
  assert.equal(isFreeTierModel("gemini-3.5-flash-lite"), true);
  assert.equal(isFreeTierModel("gemini-3.8-flash"), true);
  assert.equal(isFreeTierModel("gemini-3.1-pro"), false);
});

test("a brand-new free model can be allowed explicitly without a code change", () => {
  assert.throws(() => parseModelChain("gemini-9-flash-x"));
  assert.equal(parseModelChain("gemini-9-flash-x", new Set(["gemini-9-flash-x"]))[0]!.model, "gemini-9-flash-x");
});

test("malformed configuration fails loudly with a useful message", () => {
  assert.throws(() => parseModelChain("claude:thing"), /not supported/);
  assert.throws(() => parseModelChain("gemini:bad model!"), /invalid characters/);
  assert.throws(() => loadAiConfig({ GEMINI_API_KEY: "k", AI_MAX_ATTEMPTS: "0" }), /AI_MAX_ATTEMPTS/);
  assert.throws(() => loadAiConfig({ GEMINI_API_KEY: "k", AI_PLANS_JSON: "{oops" }), /AI_PLANS_JSON is not valid JSON/);
  assert.throws(() => loadAiConfig({ GEMINI_API_KEY: "k", AI_PLANS_JSON: '{"pro":{"maxPromptChars":-5}}' }), /AI_PLANS_JSON/);
});

test("plans are data: env overrides + new tiers without code changes", () => {
  const c = loadAiConfig({
    GEMINI_API_KEY: "k",
    AI_WINDOW_MINUTES: "60",
    AI_FREE_MAX_REQUESTS: "30",
    AI_FREE_MAX_TOKENS: "9000",
    AI_PLANS_JSON: JSON.stringify({ team: { maxRequestsPerWindow: 500, windowMs: 3_600_000 } }),
  });
  assert.equal(c.plans.free!.windowMs, 3_600_000);
  assert.equal(c.plans.free!.maxRequestsPerWindow, 30);
  assert.equal(c.plans.free!.maxTokensPerWindow, 9000);
  assert.equal(c.plans.team!.maxRequestsPerWindow, 500);
  assert.equal(c.plans.team!.maxPromptChars, c.plans.free!.maxPromptChars); // inherited
});

test("notional cost math is integer micro-USD and uses pricing overrides", () => {
  const c = testConfig();
  assert.equal(costMicros(c, "primary", 1000, 500), 1000 * 1 + 500 * 4);
  assert.equal(costMicros(c, "backup", 1000, 500), 1000 * 2 + 500 * 8);
  const unknown = costMicros(c, "mystery", 1_000_000, 0);
  assert.equal(unknown, c.defaultPricing.inPerM * 1_000_000); // falls back to conservative default
  assert.ok(Number.isInteger(costMicros(c, "primary", 3, 7)));
});
