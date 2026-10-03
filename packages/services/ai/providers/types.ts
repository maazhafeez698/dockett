import type { ProviderId } from "../config";
import type { ChatMessage } from "../prompt";

export type FinishReason = "stop" | "length" | "blocked" | "other";

export type ProviderChunk =
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "finish"; reason: FinishReason };

export interface ProviderStreamParams {
  model: string;
  system: string;
  messages: ChatMessage[];
  jsonSchema: object;
  maxOutputTokens: number;
  temperature: number;
  /** Aborts when the *user* cancels or disconnects. */
  clientSignal: AbortSignal;
  timeouts: { firstByteMs: number; idleMs: number; attemptMs: number };
}

export interface ModelProvider {
  readonly id: ProviderId;
  /**
   * Streams normalised chunks. Throws ProviderError for provider-side
   * problems and AiError("CANCELLED") when clientSignal aborts.
   */
  stream(params: ProviderStreamParams): AsyncGenerator<ProviderChunk, void, void>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
