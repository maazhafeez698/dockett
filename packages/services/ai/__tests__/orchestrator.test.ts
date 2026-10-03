import { test } from "node:test";
import assert from "node:assert/strict";
import { Orchestrator, GenerationError, type GenerationEvents } from "../orchestrator";
import { CircuitBreaker, ModelQuota } from "../resilience";
import { noopLogger } from "../logging";
import { ScriptedProvider, testConfig, ok, fail, goodJson, chunkText, type Step } from "./helpers";

function setup(scripts: Record<string, Step[]>, env: Record<string, string> = {}, quotaLimits = { rpm: 1000, rpd: 100000 }) {
  const config = testConfig(env);
  const provider = new ScriptedProvider(scripts);
  const breaker = new CircuitBreaker(config.breaker);
  const logs: Array<[string, string, any]> = [];
  const logger = {
    debug: () => {}, info: () => {},
    warn: (m: string, x: any) => logs.push(["warn", m, x]),
    error: (m: string, x: any) => logs.push(["error", m, x]),
  };
  const quota = new ModelQuota(quotaLimits);
  const orch = new Orchestrator({ config, providers: { gemini: provider }, breaker, quota, logger, sleepFn: async () => {}, rand: () => 0.5 });
  const events = { status: [] as string[], reply: "", fields: [] as string[], resets: 0 };
  const handlers: GenerationEvents = {
    onStatus: (_p, m) => events.status.push(m),
    onReplyDelta: (t) => (events.reply += t),
    onField: (_i, f) => events.fields.push(f.label),
    onReset: () => { events.reply = ""; events.fields = []; events.resets++; },
  };
  const run = (signal = new AbortController().signal) =>
    orch.run({ system: "s", messages: [{ role: "user", content: "u" }], maxOutputTokens: 500, maxFields: 30, estimatedInputTokens: 50, clientSignal: signal }, handlers, { userId: "u" });
  return { run, provider, events, breaker, logs, config };
}

test("happy path: streams reply + fields, returns validated draft and exact cost", async () => {
  const t = setup({ primary: [ok()] });
  const out = await t.run();
  assert.equal(out.model, "primary");
  assert.equal(out.attempts, 1);
  assert.equal(out.fallbackUsed, false);
  assert.equal(out.draft!.fields.length, 3);
  assert.equal(t.events.reply, "Here you go! A tidy little form.");
  assert.deepEqual(t.events.fields, ["Your name", "How did we do?", "Favourite part"]);
  assert.equal(out.costMicros, 100 * 1 + 200 * 4);
  assert.ok(out.firstTokenMs !== null);
});

test("transient failure with no output → retried once on the SAME model (no fallback, no double billing)", async () => {
  const t = setup({ primary: [fail("transient", 503), ok()], backup: [ok()] });
  const out = await t.run();
  assert.equal(out.model, "primary");
  assert.equal(out.attempts, 2);
  assert.equal(out.fallbackUsed, false);
  assert.equal(t.provider.callsFor("backup"), 0);
  assert.deepEqual(t.events.status, ["Tiny hiccup — trying that again…"]);
  assert.equal(out.costMicros, 900); // the failed attempt produced nothing, so only the successful one is billed
});

test("persistent transient failure → falls back to the next model", async () => {
  const t = setup({ primary: [fail("transient", 500)], backup: [ok()] });
  const out = await t.run();
  assert.equal(out.model, "backup");
  assert.equal(out.fallbackUsed, true);
  assert.equal(out.attempts, 3); // primary, primary retry, backup
  assert.ok(t.events.status.some((s) => /backup/i.test(s)));
});

test("rate limit (429) is never hammered: straight to fallback, zero same-model retries", async () => {
  const t = setup({ primary: [fail("rate_limit", 429, 20_000)], backup: [ok()] });
  const out = await t.run();
  assert.equal(t.provider.callsFor("primary"), 1);
  assert.equal(out.model, "backup");
});

test("auth/config errors fall back AND are logged at error level (so they get noticed)", async () => {
  const t = setup({ primary: [fail("auth", 403)], backup: [ok()] });
  const out = await t.run();
  assert.equal(out.model, "backup");
  assert.ok(t.logs.some(([lvl, m]) => lvl === "error" && m === "ai.attempt_failed"));
});

test("content blocked is final: no retry, no fallback", async () => {
  const t = setup({ primary: [fail("content_blocked")], backup: [ok()] });
  await assert.rejects(t.run(), (e: unknown) => e instanceof GenerationError && e.code === "CONTENT_BLOCKED");
  assert.equal(t.provider.callsFor("backup"), 0);
  assert.equal(t.provider.callsFor("primary"), 1);
});

test("invalid model output (bad JSON / no usable fields) → falls back; nothing invalid reaches the caller", async () => {
  const badJson = { chunks: [...chunkText('{"reply":"hi","form":{"title":"x","fields":[{"label":"a"'), { type: "finish", reason: "stop" } as const] } as Step;
  const pwOnly = ok(goodJson({ fields: [{ label: "Pw", type: "PASSWORD", description: "", placeholder: "", isRequired: true, options: [], ratingMax: 0, maxLength: 0 }] }));
  for (const bad of [badJson, pwOnly]) {
    const t = setup({ primary: [bad], backup: [ok()] });
    const out = await t.run();
    assert.equal(out.model, "backup");
    assert.ok(out.draft!.fields.every((f) => f.type !== ("PASSWORD" as never)));
  }
});

test("truncated by max tokens (finish=length) is treated as invalid, not as a partial form", async () => {
  const cut: Step = { chunks: [...chunkText(goodJson()), { type: "finish", reason: "length" }] };
  const t = setup({ primary: [cut], backup: [ok()] });
  assert.equal((await t.run()).model, "backup");
});

test("empty response → invalid → fallback", async () => {
  const t = setup({ primary: [{ chunks: [{ type: "finish", reason: "stop" }] }], backup: [ok()] });
  assert.equal((await t.run()).model, "backup");
});

test("stream dies AFTER the user saw text: client is told to discard it, tokens are still billed, fallback does not re-retry same model", async () => {
  const partial = chunkText(goodJson()).slice(0, 6);
  const dies: Step = { chunks: [...partial, { type: "usage", inputTokens: 100, outputTokens: 30 }], throw: Object.assign(new Error("reset"), {}) as never };
  // use a real ProviderError:
  const { ProviderError } = await import("../errors");
  (dies as any).throw = new ProviderError("transient", "connection reset", { outputStarted: true });
  const t = setup({ primary: [dies], backup: [ok()] });
  const out = await t.run();
  assert.equal(t.events.resets, 1);
  assert.equal(t.provider.callsFor("primary"), 1, "must not retry the model that already produced output");
  assert.equal(out.model, "backup");
  assert.equal(t.events.reply, "Here you go! A tidy little form.", "final UI state is the clean second answer");
  // billed: failed partial (100*1+30*4=220) + success on backup (100*2+200*8=1800)
  assert.equal(out.costMicros, 220 + 1800);
});

test("all models fail → single classified error; partial usage is reported for accounting", async () => {
  const t = setup({ primary: [fail("transient", 500)], backup: [fail("timeout")] });
  await assert.rejects(t.run(), (e: unknown) => {
    assert.ok(e instanceof GenerationError);
    assert.equal(e.code, "PROVIDER_TIMEOUT");
    assert.equal(e.meta.attempts, 3);
    assert.equal(e.usage.costMicros, 0);
    return true;
  });
});

test("attempt budget is capped across the chain (no runaway retries/cost)", async () => {
  const t = setup({ primary: [fail("transient", 500)], backup: [fail("transient", 500)] }, { AI_MAX_ATTEMPTS: "2" });
  await assert.rejects(t.run(), (e: unknown) => e instanceof GenerationError && e.code === "PROVIDER_UNAVAILABLE");
  assert.equal(t.provider.calls.length, 2);
});

test("429 from every model surfaces a retry-after hint", async () => {
  const t = setup({ primary: [fail("rate_limit", 429, 12_000)], backup: [fail("rate_limit", 429, 9_000)] });
  await assert.rejects(t.run(), (e: unknown) => e instanceof GenerationError && e.code === "PROVIDER_UNAVAILABLE" && e.retryAfterSec === 9);
});

test("user cancel mid-stream → CANCELLED with outputStarted=true; provider not retried", async () => {
  const ctrl = new AbortController();
  const t = setup({ primary: [{ hang: true, chunks: chunkText(goodJson()).slice(0, 5) }], backup: [ok()] });
  setTimeout(() => ctrl.abort(), 30);
  await assert.rejects(t.run(ctrl.signal), (e: unknown) => {
    assert.ok(e instanceof GenerationError);
    assert.equal(e.code, "CANCELLED");
    assert.equal(e.meta.outputStarted, true);
    return true;
  });
  assert.equal(t.provider.callsFor("backup"), 0);
});

test("already-cancelled request makes no provider call at all", async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  const t = setup({ primary: [ok()] });
  await assert.rejects(t.run(ctrl.signal), (e: unknown) => e instanceof GenerationError && e.code === "CANCELLED");
  assert.equal(t.provider.calls.length, 0);
});

test("circuit breaker: after repeated failures the bad model is skipped for later requests", async () => {
  const t = setup({ primary: [fail("transient", 500)], backup: [ok()] }, { AI_BREAKER_FAILURES: "2" });
  await t.run(); // primary fails twice (attempt + retry) → breaker opens → backup
  const before = t.provider.callsFor("primary");
  const out = await t.run();
  assert.equal(out.model, "backup");
  assert.equal(t.provider.callsFor("primary"), before, "open breaker means zero calls to the broken model");
});

test("if EVERY breaker is open we still probe instead of failing without trying", async () => {
  const t = setup({ primary: [ok()], backup: [ok()] });
  t.breaker.recordFailure("gemini:primary"); t.breaker.recordFailure("gemini:backup");
  for (let i = 0; i < 5; i++) { t.breaker.recordFailure("gemini:primary"); t.breaker.recordFailure("gemini:backup"); }
  const out = await t.run();
  assert.equal(out.model, "primary");
});

test("when provider omits usage, cost is estimated from output size rather than recorded as free", async () => {
  const noUsage: Step = { chunks: [...chunkText(goodJson()), { type: "finish", reason: "stop" }] };
  const t = setup({ primary: [noUsage] });
  const out = await t.run();
  assert.ok(out.outputTokens > 0 && out.costMicros > 0);
});

// ------------------------------------------------------------------ scope + free tier

const offTopic = (reply: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ intent: "OFF_TOPIC", reply, form: { title: "", description: "", template: "CLASSIC", submissionLayout: "ONE_AT_A_TIME", fields: [], ...extra } });

test("OFF_TOPIC: returns a short nudge and NO draft, even if the model sneaks fields in", async () => {
  const sneaky = offTopic("Ha, nice try — forms only! What form do you need?", { fields: [{ label: "Q", type: "TEXT", description: "", placeholder: "", isRequired: false, options: [], ratingMax: 0, maxLength: 0 }] });
  const t = setup({ primary: [ok(sneaky)] });
  const out = await t.run();
  assert.equal(out.intent, "OFF_TOPIC");
  assert.equal(out.draft, null);
  assert.deepEqual(t.events.fields, [], "no live field preview for non-BUILD intents");
});

test("OFF_TOPIC that starts rambling is cut off early: upstream aborted, reply clipped, tokens saved", async () => {
  const essay = "Sure, let me explain this at great length because I love explaining things. ".repeat(40);
  const json = offTopic(essay);
  const t = setup({ primary: [ok(json)] });
  const out = await t.run();
  assert.equal(out.intent, "OFF_TOPIC");
  assert.ok(out.reply.length <= 281, `reply was ${out.reply.length} chars`);
  assert.ok(t.events.reply.length <= 281, "the user never sees more than the cap, even while streaming");
  assert.equal(out.draft, null);
  assert.ok(out.outputTokens > 0 && out.costMicros > 0, "early-stopped output is still accounted for");
});

test("intent arrives first: BUILD fields stream live; fields that beat the intent are held, not lost", async () => {
  const t = setup({ primary: [ok()] });
  await t.run();
  assert.deepEqual(t.events.fields, ["Your name", "How did we do?", "Favourite part"]);
});

test("free-tier guard: a model over its per-minute quota is skipped BEFORE calling Google, falling to the next model", async () => {
  const t = setup({ primary: [ok()], backup: [ok()] }, {}, { rpm: 1, rpd: 100000 });
  const first = await t.run();
  assert.equal(first.model, "primary");
  const second = await t.run();
  assert.equal(second.model, "backup", "primary has used its 1 call this minute");
  assert.equal(t.provider.callsFor("primary"), 1);
});

test("free-tier guard: every model exhausted for the day → CAPACITY_REACHED with zero calls", async () => {
  const t = setup({ primary: [ok()], backup: [ok()] }, {}, { rpm: 1000, rpd: 0 + 1 });
  await t.run(); await t.run(); // one call each uses both daily allowances
  await assert.rejects(t.run(), (e: unknown) => e instanceof GenerationError && e.code === "CAPACITY_REACHED");
  assert.equal(t.provider.calls.length, 2);
});

test("free-tier guard: every model over its per-minute quota → friendly retry hint, zero calls", async () => {
  const t = setup({ primary: [ok()], backup: [ok()] }, {}, { rpm: 1, rpd: 100000 });
  await t.run(); await t.run();
  await assert.rejects(t.run(), (e: unknown) => e instanceof GenerationError && e.code === "PROVIDER_UNAVAILABLE" && (e.retryAfterSec ?? 0) > 0);
  assert.equal(t.provider.calls.length, 2);
});
