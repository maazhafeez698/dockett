import { loadAiConfig, type AiConfig } from "../config";
import type { ModelProvider, ProviderChunk, ProviderStreamParams } from "../providers/types";
import { ProviderError } from "../errors";
import type { Clock } from "../resilience";

export const USER = "11111111-1111-4111-8111-111111111111";
export const USER2 = "22222222-2222-4222-8222-222222222222";
let counter = 0;
export const rid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

export function testConfig(env: Record<string, string> = {}): AiConfig {
  return loadAiConfig({
    GEMINI_API_KEY: "test-key",
    AI_MODEL_CHAIN: "gemini:primary,gemini:backup",
    AI_EXTRA_FREE_MODELS: "primary,backup",
    AI_MODEL_RPM: "1000",
    AI_MODEL_RPD: "100000",
    AI_RETRY_BASE_DELAY_MS: "0",
    AI_RETRY_MAX_DELAY_MS: "5",
    AI_FIRST_BYTE_TIMEOUT_MS: "300",
    AI_IDLE_TIMEOUT_MS: "300",
    AI_ATTEMPT_TIMEOUT_MS: "2000",
    AI_TOTAL_TIMEOUT_MS: "5000",
    AI_MODEL_PRICING_JSON: JSON.stringify({ primary: { in: 1, out: 4 }, backup: { in: 2, out: 8 } }),
    ...env,
  });
}

export class FakeClock implements Clock {
  constructor(public t = Date.UTC(2026, 8, 30, 12, 0, 0)) {}
  now() {
    return this.t;
  }
  advance(ms: number) {
    this.t += ms;
  }
}

export const baseField = {
  description: "",
  placeholder: "",
  isRequired: false,
  options: [] as string[],
  ratingMax: 0,
  maxLength: 0,
};

export function goodJson(over: Partial<{ intent: string; reply: string; fields: unknown[]; title: string }> = {}): string {
  return JSON.stringify({
    intent: over.intent ?? "BUILD",
    reply: over.reply ?? "Here you go! A tidy little form.",
    form: {
      title: over.title ?? "Customer Feedback",
      description: "Tell us how we did",
      template: "SURVEY",
      submissionLayout: "ONE_AT_A_TIME",
      fields: over.fields ?? [
        { ...baseField, label: "Your name", type: "TEXT", placeholder: "Jane", isRequired: true },
        { ...baseField, label: "How did we do?", type: "RATING", ratingMax: 5 },
        { ...baseField, label: "Favourite part", type: "DROPDOWN", options: ["Food", "Service", "Vibes"] },
      ],
    },
  });
}

export function chunkText(text: string, size = 9): ProviderChunk[] {
  const out: ProviderChunk[] = [];
  for (let i = 0; i < text.length; i += size) out.push({ type: "text", text: text.slice(i, i + size) });
  return out;
}

export type Step =
  | { chunks: ProviderChunk[]; then?: "finish" }
  | { chunks?: ProviderChunk[]; throw: Error }
  | { hang: true; chunks?: ProviderChunk[] };

export const ok = (json = goodJson(), usage = { inputTokens: 100, outputTokens: 200 }): Step => ({
  chunks: [...chunkText(json), { type: "usage", ...usage }, { type: "finish", reason: "stop" }],
});
export const fail = (kind: ConstructorParameters<typeof ProviderError>[0], status?: number, retryAfterMs?: number): Step => ({
  throw: new ProviderError(kind, `simulated ${kind}`, { status, retryAfterMs }),
});

/** Scripted provider: each stream() call consumes the next step for that model; last step repeats. */
export class ScriptedProvider implements ModelProvider {
  readonly id = "gemini" as const;
  readonly calls: Array<{ model: string; system: string; userText: string }> = [];
  private readonly scripts: Record<string, Step[]>;
  private readonly idx: Record<string, number> = {};

  constructor(scripts: Record<string, Step[]>) {
    this.scripts = scripts;
  }

  callsFor(model: string) {
    return this.calls.filter((c) => c.model === model).length;
  }

  async *stream(p: ProviderStreamParams): AsyncGenerator<ProviderChunk, void, void> {
    this.calls.push({ model: p.model, system: p.system, userText: p.messages.map((m) => m.content).join("\n") });
    const list = this.scripts[p.model] ?? [];
    const i = this.idx[p.model] ?? 0;
    this.idx[p.model] = i + 1;
    const step = list[Math.min(i, list.length - 1)];
    if (!step) throw new ProviderError("bad_request", "no script");

    for (const c of step.chunks ?? []) {
      if (p.clientSignal.aborted) throw new (await import("../errors")).AiError("CANCELLED");
      yield c;
      await new Promise((r) => setImmediate(r));
    }
    if ("throw" in step) throw step.throw;
    if ("hang" in step) {
      await new Promise<void>((_, reject) => {
        p.clientSignal.addEventListener("abort", () =>
          import("../errors").then((m) => reject(new m.AiError("CANCELLED"))), { once: true });
      });
    }
  }
}
