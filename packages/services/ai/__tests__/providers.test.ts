import { test } from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider } from "../providers/gemini";
import { AiError, ProviderError } from "../errors";
import type { ProviderChunk, ProviderStreamParams } from "../providers/types";

const enc = new TextEncoder();
const sse = (events: unknown[], raw = false) => events.map((e) => `data: ${raw ? e : JSON.stringify(e)}\n\n`).join("");

function streamResponse(parts: string[], status = 200, headers: Record<string, string> = {}, delayMs = 0, hangAfter = false) {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (i < parts.length) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        ctrl.enqueue(enc.encode(parts[i++]!));
      } else if (hangAfter) {
        await new Promise(() => {}); // never resolves; relies on cancel/abort
      } else ctrl.close();
    },
  });
  return new Response(body, { status, headers });
}

function params(over: Partial<ProviderStreamParams> = {}): ProviderStreamParams {
  return {
    model: "m", system: "sys", messages: [{ role: "user", content: "hi" }], jsonSchema: { type: "object" },
    maxOutputTokens: 100, temperature: 0.3, clientSignal: new AbortController().signal,
    timeouts: { firstByteMs: 200, idleMs: 200, attemptMs: 1000 }, ...over,
  };
}
async function collect(gen: AsyncGenerator<ProviderChunk>) {
  const out: ProviderChunk[] = [];
  for await (const c of gen) out.push(c);
  return out;
}
async function expectProviderError(p: Promise<unknown>, kind: string) {
  await assert.rejects(p, (e: unknown) => e instanceof ProviderError && e.kind === kind, `expected ProviderError(${kind})`);
}

// ---------------- Gemini ----------------
test("gemini: parses text, usage (thinking billed as output) and finish; key is in a header, not the URL", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const p = new GeminiProvider({ apiKey: "SECRET-KEY", baseUrl: "https://g.test/v1beta" }, async (url, init) => {
    seen = { url, init };
    return streamResponse([sse([
      { candidates: [{ content: { parts: [{ text: "{\"a\":" }] } }] },
      { candidates: [{ content: { parts: [{ text: "hidden", thought: true }, { text: "1}" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 5, thoughtsTokenCount: 4 } },
    ])]);
  });
  const chunks = await collect(p.stream(params()));
  assert.deepEqual(chunks.filter((c) => c.type === "text").map((c: any) => c.text), ['{"a":', "1}"]);
  assert.deepEqual(chunks.find((c) => c.type === "usage"), { type: "usage", inputTokens: 11, outputTokens: 9 });
  assert.deepEqual(chunks.find((c) => c.type === "finish"), { type: "finish", reason: "stop" });
  assert.ok(!seen!.url.includes("SECRET-KEY") && !seen!.url.includes("key="));
  assert.equal((seen!.init.headers as Record<string, string>)["x-goog-api-key"], "SECRET-KEY");
  assert.match(seen!.url, /models\/m:streamGenerateContent\?alt=sse$/);
  const body = JSON.parse(seen!.init.body as string);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.contents[0].role, "user");
});

test("gemini: events split mid-line across network chunks still parse", async () => {
  const full = sse([{ candidates: [{ content: { parts: [{ text: "hello" }] } }] }]);
  const p = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () =>
    streamResponse([full.slice(0, 13), full.slice(13, 40), full.slice(40)]));
  const chunks = await collect(p.stream(params()));
  assert.deepEqual(chunks, [{ type: "text", text: "hello" }]);
});

test("gemini: HTTP errors are classified (429 keeps Retry-After, 5xx transient, 401 auth, 400 bad_request)", async () => {
  const mk = (status: number, headers: Record<string, string> = {}) =>
    new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () =>
      new Response(JSON.stringify({ error: { message: "nope key=AIzaSyABCDEFGHIJKLMNOP" } }), { status, headers }));
  await expectProviderError(collect(mk(429, { "retry-after": "7" }).stream(params())), "rate_limit");
  const rl = await collect(mk(429, { "retry-after": "7" }).stream(params())).catch((e) => e);
  assert.equal(rl.retryAfterMs, 7000);
  await expectProviderError(collect(mk(503).stream(params())), "transient");
  await expectProviderError(collect(mk(500).stream(params())), "transient");
  await expectProviderError(collect(mk(401).stream(params())), "auth");
  await expectProviderError(collect(mk(403).stream(params())), "auth");
  await expectProviderError(collect(mk(400).stream(params())), "bad_request");
  const e = await collect(mk(400).stream(params())).catch((x) => x);
  assert.ok(!String(e.message).includes("AIzaSy"), "credentials must be scrubbed from error text");
});

test("gemini: safety blocks → content_blocked; mid-stream error chunk → classified with outputStarted", async () => {
  const blockedPrompt = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () => streamResponse([sse([{ promptFeedback: { blockReason: "SAFETY" } }])]));
  await expectProviderError(collect(blockedPrompt.stream(params())), "content_blocked");

  const finishBlocked = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () =>
    streamResponse([sse([{ candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "SAFETY" }] }])]));
  const chunks = await collect(finishBlocked.stream(params()));
  assert.deepEqual(chunks.at(-1), { type: "finish", reason: "blocked" });

  const midError = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () =>
    streamResponse([sse([{ candidates: [{ content: { parts: [{ text: "partial" }] } }] }, { error: { code: 503, message: "overloaded" } }])]));
  const err = await collect(midError.stream(params())).catch((e) => e);
  assert.ok(err instanceof ProviderError);
  assert.equal(err.kind, "transient");
  assert.equal(err.outputStarted, true);
});

test("gemini: garbage event → invalid_response; network failure → transient", async () => {
  const garbage = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () => streamResponse([sse(["{not json"], true)]));
  await expectProviderError(collect(garbage.stream(params())), "invalid_response");
  const down = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async () => { throw new TypeError("fetch failed"); });
  await expectProviderError(collect(down.stream(params())), "transient");
});

test("timeouts: no first byte → timeout; stall mid-stream → timeout (idle)", async () => {
  const slow = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, (_u, init) =>
    new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))));
  const t0 = Date.now();
  await expectProviderError(collect(slow.stream(params({ timeouts: { firstByteMs: 60, idleMs: 60, attemptMs: 1000 } }))), "timeout");
  assert.ok(Date.now() - t0 < 600);

  const stall = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async (_u, init) => {
    const r = streamResponse([sse([{ candidates: [{ content: { parts: [{ text: "a" }] } }] }])], 200, {}, 0, true);
    init.signal!.addEventListener("abort", () => {});
    return r;
  });
  await expectProviderError(collect(stall.stream(params({ timeouts: { firstByteMs: 200, idleMs: 60, attemptMs: 1000 } }))), "timeout");
});

test("client abort → AiError(CANCELLED) and the upstream request is aborted", async () => {
  const ctrl = new AbortController();
  let upstreamAborted = false;
  const p = new GeminiProvider({ apiKey: "k", baseUrl: "https://g.test" }, async (_u, init) => {
    init.signal!.addEventListener("abort", () => { upstreamAborted = true; });
    return streamResponse([sse([{ candidates: [{ content: { parts: [{ text: "a" }] } }] }])], 200, {}, 0, true);
  });
  setTimeout(() => ctrl.abort(), 40);
  await assert.rejects(collect(p.stream(params({ clientSignal: ctrl.signal }))), (e: unknown) => e instanceof AiError && e.code === "CANCELLED");
  assert.equal(upstreamAborted, true);
});
