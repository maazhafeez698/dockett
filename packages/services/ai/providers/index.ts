import type { AiConfig, ProviderId } from "../config";
import { GeminiProvider } from "./gemini";
import type { FetchLike, ModelProvider } from "./types";

export type { ModelProvider, ProviderChunk, ProviderStreamParams, FetchLike } from "./types";

/**
 * Free-tier build: Gemini is the only provider. The ModelProvider interface
 * is kept so another provider can be added later without touching the
 * orchestrator — but nothing paid is wired in.
 */
export function createProviders(config: AiConfig, fetchImpl?: FetchLike): Partial<Record<ProviderId, ModelProvider>> {
  const out: Partial<Record<ProviderId, ModelProvider>> = {};
  if (config.providers.gemini) {
    out.gemini = new GeminiProvider({ ...config.providers.gemini, thinkingLevel: config.geminiThinkingLevel }, fetchImpl);
  }
  return out;
}
