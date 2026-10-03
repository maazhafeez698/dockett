import { AiError, ProviderError, describeError, type AiErrorCode } from "./errors";
import { costMicros, type AiConfig, type ModelRef } from "./config";
import {
  LIMITS,
  MODEL_OUTPUT_JSON_SCHEMA,
  clipReply,
  normalizeModelOutput,
  normalizeRawField,
  parseModelJson,
  type AiIntent,
  type DraftField,
  type FormDraft,
} from "./draft";
import { FormStreamParser } from "./stream-parser";
import type { ChatMessage } from "./prompt";
import type { AiLogger } from "./logging";
import { backoffDelay, sleep, systemClock, type CircuitBreaker, type Clock, type ModelQuota } from "./resilience";
import type { ModelProvider } from "./providers";
import type { ProviderId } from "./config";

/**
 * Runs one user request against the model chain and turns it into either a
 * validated result or a single, well-classified error.
 *
 * Reliability rules (each one exists to avoid a specific failure mode):
 *  - Total attempts across the whole chain are capped (config.retry.maxAttempts)
 *    and the whole request has a hard deadline — retries can never snowball
 *    into a runaway bill or a hung request.
 *  - Same-model retry happens only for transient/timeout failures where the
 *    model produced NO output yet; otherwise we move to the next model.
 *  - Rate-limit (429) responses are never hammered: fall back immediately.
 *  - Safety blocks are final — no retry, no fallback.
 *  - If a stream dies after the user already saw text, the client is told to
 *    discard it (`onReset`) before the next attempt starts streaming.
 *  - Every attempt's billable tokens are accumulated (even failed ones) so
 *    accounting reflects what was actually spent.
 */

export interface GenerationEvents {
  onStatus(phase: "retrying" | "fallback", message: string): void;
  onReplyDelta(text: string): void;
  onField(index: number, field: DraftField): void;
  onReset(reason: string): void;
}

export interface GenerationParams {
  system: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  maxFields: number;
  /** Conservative input-token estimate, used only if a provider never reports usage. */
  estimatedInputTokens: number;
  clientSignal: AbortSignal;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

export interface GenerationOutcome extends UsageTotals {
  intent: AiIntent;
  reply: string;
  draft: FormDraft | null;
  provider: ProviderId;
  model: string;
  attempts: number;
  fallbackUsed: boolean;
  firstTokenMs: number | null;
}

export class GenerationError extends AiError {
  constructor(
    code: AiErrorCode,
    readonly usage: UsageTotals,
    readonly meta: {
      attempts: number;
      fallbackUsed: boolean;
      outputStarted: boolean;
      provider?: ProviderId;
      model?: string;
      firstTokenMs: number | null;
    },
    opts: { retryAfterSec?: number; cause?: unknown } = {},
  ) {
    super(code, undefined, opts);
    this.name = "GenerationError";
  }
}

function errorCodeFor(e: ProviderError): AiErrorCode {
  switch (e.kind) {
    case "timeout":
      return "PROVIDER_TIMEOUT";
    case "invalid_response":
      return "INVALID_RESPONSE";
    case "content_blocked":
      return "CONTENT_BLOCKED";
    default:
      return "PROVIDER_UNAVAILABLE";
  }
}

const modelKey = (ref: ModelRef) => `${ref.provider}:${ref.model}`;

export interface OrchestratorDeps {
  config: AiConfig;
  providers: Partial<Record<ProviderId, ModelProvider>>;
  breaker: CircuitBreaker;
  /** Free-tier guard: per-model requests/minute and requests/day. */
  quota: ModelQuota;
  logger: AiLogger;
  clock?: Clock;
  rand?: () => number;
  sleepFn?: typeof sleep;
}

export class Orchestrator {
  private readonly clock: Clock;
  private readonly rand: () => number;
  private readonly sleepFn: typeof sleep;

  constructor(private readonly deps: OrchestratorDeps) {
    this.clock = deps.clock ?? systemClock;
    this.rand = deps.rand ?? Math.random;
    this.sleepFn = deps.sleepFn ?? sleep;
  }

  async run(params: GenerationParams, events: GenerationEvents, logCtx: Record<string, unknown>): Promise<GenerationOutcome> {
    const { config, breaker, logger } = this.deps;
    const startedAt = this.clock.now();
    const deadline = startedAt + config.timeouts.totalMs;

    const chain = config.chain.filter((r) => this.deps.providers[r.provider]);
    // Prefer models whose breaker is closed; if every model is tripped, try
    // them anyway — failing fast with no attempt at all is worse than a probe.
    const open = chain.filter((r) => !breaker.isOpen(modelKey(r)));
    const ordered = open.length ? open : chain;

    const totals: UsageTotals = { inputTokens: 0, outputTokens: 0, costMicros: 0 };
    let attempts = 0;
    let fallbackUsed = false;
    let outputStarted = false;
    let firstTokenMs: number | null = null;
    let lastError: ProviderError | null = null;
    let lastRef: ModelRef | undefined;
    const skipped: Array<"rpm" | "rpd"> = [];
    let skippedRetryMs = Infinity;

    const fail = (code: AiErrorCode, cause?: unknown, retryAfterSec?: number) =>
      new GenerationError(code, { ...totals }, {
        attempts,
        fallbackUsed,
        outputStarted,
        provider: lastRef?.provider,
        model: lastRef?.model,
        firstTokenMs,
      }, { cause, retryAfterSec });

    for (let mi = 0; mi < ordered.length; mi++) {
      const ref = ordered[mi]!;
      lastRef = ref;
      let sameModelTries = 0;

      while (true) {
        if (params.clientSignal.aborted) throw fail("CANCELLED");
        if (attempts >= config.retry.maxAttempts) break;
        const remaining = deadline - this.clock.now();
        if (remaining <= 500) {
          logger.warn("ai.deadline_exceeded", { ...logCtx, attempts });
          throw fail("PROVIDER_TIMEOUT");
        }

        // Free-tier guard: never knowingly send a call Google would reject with 429.
        const q = this.deps.quota.tryAcquire(modelKey(ref));
        if (!q.ok) {
          skipped.push(q.reason!);
          if (q.retryAfterMs) skippedRetryMs = Math.min(skippedRetryMs, q.retryAfterMs);
          logger.info("ai.model_skipped_quota", { ...logCtx, model: ref.model, reason: q.reason });
          break; // try the next model
        }

        attempts += 1;
        if (mi > 0) fallbackUsed = true;

        const attempt = await this.attemptOnce(ref, params, events, remaining, attempts, logCtx);
        totals.inputTokens += attempt.inputTokens;
        totals.outputTokens += attempt.outputTokens;
        totals.costMicros += attempt.costMicros;
        outputStarted = outputStarted || attempt.outputStarted;
        if (firstTokenMs === null && attempt.firstTokenMs !== null) firstTokenMs = attempt.firstTokenMs - startedAt;

        if (attempt.ok) {
          breaker.recordSuccess(modelKey(ref));
          return {
            ...totals,
            intent: attempt.ok.intent,
            reply: attempt.ok.reply,
            draft: attempt.ok.draft,
            provider: ref.provider,
            model: ref.model,
            attempts,
            fallbackUsed,
            firstTokenMs,
          };
        }

        const err = attempt.error!;
        if (err instanceof AiError && err.code === "CANCELLED") throw fail("CANCELLED");
        if (!(err instanceof ProviderError)) {
          logger.error("ai.attempt_unexpected_error", { ...logCtx, attempt: attempts, model: ref.model, err: describeError(err) });
          throw fail("INTERNAL", err);
        }

        lastError = err;
        if (err.kind !== "content_blocked") {
          const opened = breaker.recordFailure(modelKey(ref));
          if (opened) logger.error("ai.circuit_open", { ...logCtx, provider: ref.provider, model: ref.model });
        }

        const level = err.kind === "auth" || err.kind === "bad_request" ? "error" : "warn";
        logger[level]("ai.attempt_failed", {
          ...logCtx,
          attempt: attempts,
          provider: ref.provider,
          model: ref.model,
          kind: err.kind,
          status: err.status,
          outputStarted: err.outputStarted,
          message: describeError(err).message,
        });

        if (err.kind === "content_blocked") throw fail("CONTENT_BLOCKED", err);

        if (attempt.emitted) events.onReset("The connection hiccuped, so I'm starting that answer over.");

        const canRetrySame =
          sameModelTries < config.retry.sameModelRetries &&
          !err.outputStarted &&
          (err.kind === "transient" || err.kind === "timeout");
        const lastInChain = mi === ordered.length - 1;
        const shortRateLimit = err.kind === "rate_limit" && lastInChain && (err.retryAfterMs ?? Infinity) <= 3000 && sameModelTries < 1;

        if (canRetrySame || shortRateLimit) {
          sameModelTries += 1;
          const delay = Math.min(
            err.retryAfterMs ?? backoffDelay(sameModelTries, config.retry.baseDelayMs, config.retry.maxDelayMs, this.rand),
            config.retry.maxDelayMs,
          );
          events.onStatus("retrying", "Tiny hiccup — trying that again…");
          await this.sleepFn(delay, params.clientSignal);
          continue;
        }

        if (!lastInChain) events.onStatus("fallback", "Switching to a backup model…");
        break; // next model
      }

      if (attempts >= config.retry.maxAttempts) break;
    }

    if (!lastError) {
      // Nothing was even attempted: every model was over its free-tier quota.
      if (skipped.length && skipped.every((r) => r === "rpd")) throw fail("CAPACITY_REACHED");
      const wait = Number.isFinite(skippedRetryMs) ? Math.ceil(skippedRetryMs / 1000) : 15;
      throw fail("PROVIDER_UNAVAILABLE", undefined, wait);
    }
    const retryAfterSec =
      lastError.kind === "rate_limit" && lastError.retryAfterMs ? Math.ceil(lastError.retryAfterMs / 1000) : undefined;
    logger.error("ai.all_attempts_failed", {
      ...logCtx,
      attempts,
      lastKind: lastError.kind,
      lastStatus: lastError.status,
      lastModel: lastRef?.model,
    });
    throw fail(errorCodeFor(lastError), lastError, retryAfterSec);
  }

  private async attemptOnce(
    ref: ModelRef,
    params: GenerationParams,
    events: GenerationEvents,
    remainingMs: number,
    attemptNo: number,
    logCtx: Record<string, unknown>,
  ): Promise<{
    ok?: { intent: AiIntent; reply: string; draft: FormDraft | null };
    error?: unknown;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    outputStarted: boolean;
    emitted: boolean;
    firstTokenMs: number | null;
  }> {
    const { config, providers, logger } = this.deps;
    const provider = providers[ref.provider]!;
    const t = config.timeouts;

    let emitted = false;
    let fieldCount = 0;
    let reportedIn: number | null = null;
    let reportedOut: number | null = null;
    let textChars = 0;
    let firstTokenAt: number | null = null;
    let finish: string | null = null;
    let liveIntent = null as string | null;
    let emittedReplyChars = 0;
    const pendingFields: string[] = [];

    const emitField = (raw: string) => {
      try {
        if (fieldCount >= params.maxFields) return;
        const field = normalizeRawField(JSON.parse(raw));
        if (field) {
          emitted = true;
          events.onField(fieldCount++, field);
        }
      } catch {
        /* the authoritative final parse decides validity */
      }
    };

    const parser = new FormStreamParser({
      onIntent: (intent) => {
        liveIntent = intent.trim().toUpperCase();
        // Fields that arrived before we knew the intent are only shown for BUILD.
        if (liveIntent === "BUILD") for (const raw of pendingFields) emitField(raw);
        pendingFields.length = 0;
      },
      onReplyDelta: (text) => {
        // Scope enforcement while streaming: a non-BUILD reply is a nudge, never an answer.
        if (liveIntent && liveIntent !== "BUILD") {
          const room = LIMITS.replyOther - emittedReplyChars;
          if (room <= 0) return;
          text = text.slice(0, room);
        }
        emittedReplyChars += text.length;
        emitted = true;
        events.onReplyDelta(text);
      },
      onFieldObject: (raw) => {
        if (liveIntent === null) pendingFields.push(raw);
        else if (liveIntent === "BUILD") emitField(raw);
      },
    });

    let earlyStopped = false as boolean;

    const billed = (): { inputTokens: number; outputTokens: number; costMicros: number } => {
      let inTok = reportedIn;
      let outTok = reportedOut;
      if (inTok === null || outTok === null) {
        // Provider never reported usage. If output flowed, bill an estimate; otherwise nothing was generated.
        if (textChars === 0) return { inputTokens: 0, outputTokens: 0, costMicros: 0 };
        inTok = inTok ?? params.estimatedInputTokens;
        outTok = outTok ?? Math.ceil(textChars / 3.5);
      }
      return { inputTokens: inTok, outputTokens: outTok, costMicros: costMicros(config, ref.model, inTok, outTok) };
    };

    try {
      const stream = provider.stream({
        model: ref.model,
        system: params.system,
        messages: params.messages,
        jsonSchema: MODEL_OUTPUT_JSON_SCHEMA,
        maxOutputTokens: params.maxOutputTokens,
        temperature: config.temperature,
        clientSignal: params.clientSignal,
        timeouts: {
          firstByteMs: Math.min(t.firstByteMs, remainingMs),
          idleMs: Math.min(t.idleMs, remainingMs),
          attemptMs: Math.min(t.attemptMs, remainingMs),
        },
      });

      for await (const chunk of stream) {
        if (chunk.type === "text") {
          if (firstTokenAt === null) firstTokenAt = this.clock.now();
          textChars += chunk.text.length;
          parser.feed(chunk.text);
          // Off-topic / chit-chat that starts rambling: stop paying for it. The reply
          // we already have is clipped to a short nudge and the upstream call is aborted.
          if (liveIntent && liveIntent !== "BUILD" && parser.replySoFar.length >= LIMITS.replyOther + 40) {
            earlyStopped = true;
            break;
          }
        } else if (chunk.type === "usage") {
          reportedIn = chunk.inputTokens;
          reportedOut = chunk.outputTokens;
        } else {
          finish = chunk.reason;
        }
      }

      if (earlyStopped) {
        const b = billed();
        const intent = (liveIntent ?? "OFF_TOPIC") as AiIntent;
        logger.info("ai.early_stop", { ...logCtx, intent, model: ref.model });
        return {
          ok: { intent, reply: clipReply(parser.replySoFar, LIMITS.replyOther), draft: null },
          ...b,
          outputStarted: true,
          emitted,
          firstTokenMs: firstTokenAt,
        };
      }

      if (textChars === 0) {
        throw new ProviderError("invalid_response", "Model returned no content", { outputStarted: false });
      }
      if (finish === "blocked") throw new ProviderError("content_blocked", "Response blocked by safety filter", { outputStarted: true });
      if (finish === "length") throw new ProviderError("invalid_response", "Response was cut off (max tokens)", { outputStarted: true });

      let normalized;
      try {
        normalized = normalizeModelOutput(parseModelJson(parser.text), { maxFields: params.maxFields });
      } catch (e) {
        throw new ProviderError("invalid_response", `Unusable model output: ${describeError(e).message}`, { outputStarted: true, cause: e });
      }

      const b = billed();
      logger.debug("ai.attempt_ok", { ...logCtx, attempt: attemptNo, provider: ref.provider, model: ref.model, ...b });
      return {
        ok: { intent: normalized.intent, reply: normalized.reply, draft: normalized.draft },
        ...b,
        outputStarted: true,
        emitted,
        firstTokenMs: firstTokenAt,
      };
    } catch (error) {
      if (error instanceof ProviderError && textChars > 0) error.outputStarted = true;
      const b = billed();
      return { error, ...b, outputStarted: textChars > 0, emitted, firstTokenMs: firstTokenAt };
    }
  }
}
