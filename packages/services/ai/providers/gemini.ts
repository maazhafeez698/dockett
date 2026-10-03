import { ProviderError, scrub } from "../errors";
import { classifyStatus, postSse } from "./http";
import type { FetchLike, FinishReason, ModelProvider, ProviderChunk, ProviderStreamParams } from "./types";

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
}

const BLOCKED_REASONS = new Set([
  "SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
  "LANGUAGE",
]);

function mapFinish(reason: string): FinishReason {
  if (reason === "STOP") return "stop";
  if (reason === "MAX_TOKENS") return "length";
  if (BLOCKED_REASONS.has(reason)) return "blocked";
  return "other";
}

export class GeminiProvider implements ModelProvider {
  readonly id = "gemini" as const;

  constructor(
    private readonly cfg: { apiKey: string; baseUrl: string; thinkingLevel?: string },
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
  ) {}

  async *stream(p: ProviderStreamParams): AsyncGenerator<ProviderChunk, void, void> {
    const generationConfig: Record<string, unknown> = {
      temperature: p.temperature,
      maxOutputTokens: p.maxOutputTokens,
      responseMimeType: "application/json",
      responseJsonSchema: p.jsonSchema,
    };
    if (this.cfg.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: this.cfg.thinkingLevel };

    const body = {
      systemInstruction: { parts: [{ text: p.system }] },
      contents: p.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig,
    };

    // The key travels in a header, never in the URL, so it can't leak via access logs or error strings.
    const url = `${this.cfg.baseUrl}/models/${encodeURIComponent(p.model)}:streamGenerateContent?alt=sse`;

    let sawText = false;
    for await (const data of postSse({
      fetchImpl: this.fetchImpl,
      url,
      headers: { "x-goog-api-key": this.cfg.apiKey },
      body,
      clientSignal: p.clientSignal,
      timeouts: p.timeouts,
    })) {
      let chunk: GeminiChunk;
      try {
        chunk = JSON.parse(data) as GeminiChunk;
      } catch {
        throw new ProviderError("invalid_response", "Provider sent an unparseable stream event", { outputStarted: sawText });
      }

      if (chunk.error) {
        const status = chunk.error.code ?? 500;
        throw new ProviderError(classifyStatus(status), `Provider error ${status}: ${scrub(chunk.error.message ?? "unknown", 160)}`, {
          status,
          outputStarted: sawText,
        });
      }

      if (chunk.promptFeedback?.blockReason) {
        throw new ProviderError("content_blocked", `Prompt blocked: ${chunk.promptFeedback.blockReason}`, { outputStarted: sawText });
      }

      const u = chunk.usageMetadata;
      if (u) {
        yield {
          type: "usage",
          inputTokens: u.promptTokenCount ?? 0,
          // Thinking tokens are billed as output.
          outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
        };
      }

      const cand = chunk.candidates?.[0];
      for (const part of cand?.content?.parts ?? []) {
        if (part.thought) continue;
        if (typeof part.text === "string" && part.text.length) {
          sawText = true;
          yield { type: "text", text: part.text };
        }
      }
      if (cand?.finishReason && cand.finishReason !== "FINISH_REASON_UNSPECIFIED") {
        yield { type: "finish", reason: mapFinish(cand.finishReason) };
      }
    }
  }
}
