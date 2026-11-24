import { z } from "zod";

import { AiError, describeError } from "./errors";
import type { AiConfig, ProviderId } from "./config";
import { AI_TEMPLATES, MODEL_OUTPUT_JSON_SCHEMA, formDraftSchema, type AiIntent, type DraftField, type FormDraft } from "./draft";
import { isPremiumTemplate } from "../billing/plans";
import { preScreen } from "./guard";
import { GenerationError, Orchestrator } from "./orchestrator";
import { buildMessages, buildSystemPrompt, estimateTokens, renderForm, type AiMode } from "./prompt";
import { CircuitBreaker, ModelQuota, systemClock, type Clock } from "./resilience";
import { createProviders, type FetchLike, type ModelProvider } from "./providers";
import { noopLogger, type AiLogger } from "./logging";
import { UsageService, planLimits, type Admission, type Credits, type UsageSummary } from "./usage";
import { quotaError, type UsageStore } from "./usage-store";

export const aiStreamRequestSchema = z.object({
  requestId: z.string().uuid("requestId must be a UUID"),
  mode: z.enum(["NEW_FORM", "ADD_FIELDS"]),
  formId: z.string().uuid().optional(),
  prompt: z.string().trim().min(1, "Tell me what kind of form you'd like").max(8000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(40)
    .default([]),
  // The client's pending draft, so "make it shorter" can build on it.
  currentDraft: formDraftSchema.optional(),
});
export type AiStreamRequest = z.infer<typeof aiStreamRequestSchema>;

export interface ExistingFormContext {
  title: string;
  fields: Array<Pick<DraftField, "label" | "type" | "isRequired" | "config">>;
}

// Server -> client SSE events. Mirrored by apps/web/lib/ai-stream.ts. 
export type AiStreamEvent =
  | { event: "meta"; data: { requestId: string; credits: Credits } }
  | { event: "status"; data: { phase: "retrying" | "fallback"; message: string } }
  | { event: "reply"; data: { delta: string } }
  | { event: "field"; data: { index: number; field: DraftField } }
  | { event: "reset"; data: { reason: string } }
  | {
      event: "done";
      data: { requestId: string; intent: AiIntent; reply: string; draft: FormDraft | null; credits: Credits };
    }
  | {
      event: "error";
      data: { code: string; message: string; retryAfterSec?: number; credits?: Credits };
    };

export type EventSink = (evt: AiStreamEvent) => void;

export interface AiSession {
  readonly requestId: string;
  run(sink: EventSink): Promise<void>;
}

export interface EngineDeps {
  config: AiConfig;
  store: UsageStore;
  logger?: AiLogger;
  clock?: Clock;
  loadForm(userId: string, formId: string): Promise<ExistingFormContext | null>;
  
  resolveAccount?(userId: string): Promise<{ planKey: string; premiumTemplates: boolean }>;
  providers?: Partial<Record<ProviderId, ModelProvider>>;
  fetchImpl?: FetchLike;
}

export class AiFormEngine {
  readonly usage: UsageService;
  private readonly orchestrator: Orchestrator;
  private readonly quota: ModelQuota;
  private readonly logger: AiLogger;
  private readonly clock: Clock;

  constructor(private readonly deps: EngineDeps) {
    this.logger = deps.logger ?? noopLogger;
    this.clock = deps.clock ?? systemClock;
    const providers = deps.providers ?? createProviders(deps.config, deps.fetchImpl);
    const breaker = new CircuitBreaker(deps.config.breaker, this.clock);
    this.quota = new ModelQuota({ rpm: deps.config.freeTier.rpmPerModel, rpd: deps.config.freeTier.rpdPerModel }, this.clock);
    this.orchestrator = new Orchestrator({
      config: deps.config,
      providers,
      breaker,
      quota: this.quota,
      logger: this.logger,
      clock: this.clock,
    });
    this.usage = new UsageService(
      deps.config,
      deps.store,
      this.logger,
      this.clock,
      async (userId) => (await this.account(userId)).planKey,
    );
  }

  private account(userId: string) {
    return this.deps.resolveAccount?.(userId) ?? Promise.resolve({ planKey: "free", premiumTemplates: false });
  }

  get enabled(): boolean {
    return this.deps.config.enabled;
  }

  async getUsageSummary(userId: string): Promise<UsageSummary & { enabled: boolean }> {
    return { ...(await this.usage.summary(userId)), enabled: this.enabled };
  }

  async start(userId: string, rawInput: unknown, clientSignal: AbortSignal): Promise<AiSession> {
    const { config } = this.deps;
    if (!this.enabled) throw new AiError("AI_DISABLED");

    const parsed = aiStreamRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new AiError("INVALID_REQUEST", `Invalid request: ${parsed.error.issues[0]?.message ?? "bad shape"}`, {
        userMessage: parsed.error.issues[0]?.message ?? undefined,
      });
    }
    const input = parsed.data;

    const account = await this.account(userId);
    const limits = planLimits(config, account.planKey);
    const allowedTemplates = AI_TEMPLATES.filter((t) => account.premiumTemplates || !isPremiumTemplate(t));

    if (input.prompt.length > limits.maxPromptChars) {
      throw new AiError("PAYLOAD_TOO_LARGE", "Prompt exceeds plan limit", {
        userMessage: `That message is a bit long — please keep it under ${limits.maxPromptChars} characters.`,
      });
    }

    // Cheapest checks first: nothing below touches the model.
    this.usage.assertNotCoolingDown(userId);
    this.usage.checkBurst(userId, limits);

    // Out of credits means out of credits — even for messages we could answer locally.
    const { credits: before } = await this.usage.creditsFor(userId);
    if (before.limitReached) {
      throw quotaError("window", new Date(before.resetsAt ?? this.clock.now() + limits.windowMs), new Date(this.clock.now()));
    }

    // Local pre-screen: greetings and blatant off-topic/jailbreak messages get a
    // friendly canned nudge - zero tokens, zero model calls, no credits used.
    const screened = preScreen(input.prompt);
    if (screened) {
      if (screened.strike) this.usage.recordStrike(userId);
      this.logger.info("ai.prescreen_handled", { userId, requestId: input.requestId, kind: screened.kind });
      return {
        requestId: input.requestId,
        run: async (sink) => {
          const send: EventSink = (evt) => {
            try {
              sink(evt);
            } catch {
            }
          };
          send({ event: "meta", data: { requestId: input.requestId, credits: before } });
          send({ event: "reply", data: { delta: screened.reply } });
          send({
            event: "done",
            data: {
              requestId: input.requestId,
              intent: screened.kind === "GREETING" ? "CHAT" : "OFF_TOPIC",
              reply: screened.reply,
              draft: null,
              credits: before,
            },
          });
        },
      };
    }

    // Context the model needs: the form on the canvas and/or the user's pending draft.
    let mode: AiMode = input.mode;
    let existing: ExistingFormContext | null = null;
    if (input.mode === "ADD_FIELDS") {
      if (!input.formId) throw new AiError("INVALID_REQUEST", "formId is required when adding fields");
      existing = await this.deps.loadForm(userId, input.formId);
      if (!existing) throw new AiError("FORM_NOT_FOUND");
      // An empty canvas means the user wants a whole form, not "additions".
      if (existing.fields.length === 0) mode = "NEW_FORM";
    }

    const maxCtx = 60;
    const contextParts: string[] = [];
    if (mode === "ADD_FIELDS") {
      contextParts.push(renderForm("current_form", existing, maxCtx));
      if (input.currentDraft) contextParts.push(renderForm("pending_draft", input.currentDraft, maxCtx));
    } else if (input.currentDraft) {
      contextParts.push(renderForm("current_form", input.currentDraft, maxCtx));
    }

    const system = buildSystemPrompt(mode, limits, allowedTemplates);
    const messages = buildMessages({
      history: input.history,
      prompt: input.prompt,
      contextText: contextParts.filter(Boolean).join("\n\n"),
      limits,
    });

    const estimatedInputTokens =
      estimateTokens(system) +
      estimateTokens(JSON.stringify(MODEL_OUTPUT_JSON_SCHEMA)) +
      messages.reduce((n, m) => n + estimateTokens(m.content), 0);

    const admission = await this.usage.admit({
      userId,
      requestId: input.requestId,
      formId: input.mode === "ADD_FIELDS" ? (input.formId ?? null) : null,
      prompt: input.prompt,
      promptChars: input.prompt.length,
      estimatedInputTokens,
    });

    return {
      requestId: input.requestId,
      run: (sink) =>
        this.execute({ admission, system, messages, mode, estimatedInputTokens, clientSignal, sink, allowedTemplates }),
    };
  }

  private async execute(ctx: {
    admission: Admission;
    system: string;
    messages: ReturnType<typeof buildMessages>;
    mode: AiMode;
    estimatedInputTokens: number;
    clientSignal: AbortSignal;
    sink: EventSink;
    allowedTemplates: readonly string[];
  }): Promise<void> {
    const { admission, sink } = ctx;
    const { limits } = admission;
    const logCtx = { userId: admission.userId, requestId: admission.requestId, mode: ctx.mode, plan: admission.planKey };

    // The client may already be gone; a throwing sink must never break accounting.
    const send: EventSink = (evt) => {
      try {
        sink(evt);
      } catch {
        // connection closed 
      }
    };

    send({ event: "meta", data: { requestId: admission.requestId, credits: this.usage.creditsAfter(admission, 0, true) } });

    try {
      const outcome = await this.orchestrator.run(
        {
          system: ctx.system,
          messages: ctx.messages,
          maxOutputTokens: limits.maxOutputTokens,
          maxFields: limits.maxFieldsPerForm,
          estimatedInputTokens: ctx.estimatedInputTokens,
          clientSignal: ctx.clientSignal,
          allowedTemplates: ctx.allowedTemplates,
        },
        {
          onStatus: (phase, message) => send({ event: "status", data: { phase, message } }),
          onReplyDelta: (delta) => send({ event: "reply", data: { delta } }),
          onField: (index, field) => send({ event: "field", data: { index, field } }),
          onReset: (reason) => send({ event: "reset", data: { reason } }),
        },
        logCtx,
      );

      await this.usage.settle(admission, {
        status: "SUCCEEDED",
        provider: outcome.provider,
        model: outcome.model,
        intent: outcome.intent,
        attempts: outcome.attempts,
        fallbackUsed: outcome.fallbackUsed,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        actualCostMicros: outcome.costMicros,
        countRequest: true,
        firstTokenMs: outcome.firstTokenMs,
        errorCode: null,
      });
      if (outcome.intent === "OFF_TOPIC") this.usage.recordStrike(admission.userId);

      this.logger.info("ai.request_completed", {
        ...logCtx,
        intent: outcome.intent,
        provider: outcome.provider,
        model: outcome.model,
        attempts: outcome.attempts,
        fallbackUsed: outcome.fallbackUsed,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        notionalCostMicros: outcome.costMicros,
        firstTokenMs: outcome.firstTokenMs,
        producedForm: outcome.draft !== null,
        fields: outcome.draft?.fields.length ?? 0,
      });

      send({
        event: "done",
        data: {
          requestId: admission.requestId,
          intent: outcome.intent,
          reply: outcome.reply,
          draft: outcome.draft,
          credits: this.usage.creditsAfter(admission, outcome.inputTokens + outcome.outputTokens, true),
        },
      });
    } catch (e) {
      const genErr = e instanceof GenerationError ? e : null;
      const aiErr = e instanceof AiError ? e : new AiError("INTERNAL", undefined, { cause: e });
      const cancelled = aiErr.code === "CANCELLED";

      // Cancelled-after-output still consumes a message (stops cancel-spam
      // from being a free way to burn tokens); everything else is refunded.
      const countRequest = cancelled && (genErr?.meta.outputStarted ?? false);
      const spent = (genErr?.usage.inputTokens ?? 0) + (genErr?.usage.outputTokens ?? 0);

      await this.usage.settle(admission, {
        status: cancelled ? "CANCELLED" : "FAILED",
        provider: genErr?.meta.provider ?? null,
        model: genErr?.meta.model ?? null,
        intent: null,
        attempts: genErr?.meta.attempts ?? 0,
        fallbackUsed: genErr?.meta.fallbackUsed ?? false,
        inputTokens: genErr?.usage.inputTokens ?? 0,
        outputTokens: genErr?.usage.outputTokens ?? 0,
        actualCostMicros: genErr?.usage.costMicros ?? 0,
        countRequest,
        firstTokenMs: genErr?.meta.firstTokenMs ?? null,
        errorCode: aiErr.code,
      });

      if (aiErr.code === "INTERNAL") {
        this.logger.error("ai.request_internal_error", { ...logCtx, err: describeError(e) });
      } else {
        this.logger[cancelled ? "info" : "warn"]("ai.request_failed", {
          ...logCtx,
          code: aiErr.code,
          attempts: genErr?.meta.attempts,
          tokens: spent,
        });
      }

      if (!cancelled) {
        send({
          event: "error",
          data: {
            code: aiErr.code,
            message: aiErr.userMessage,
            retryAfterSec: aiErr.retryAfterSec,
            credits: this.usage.creditsAfter(admission, spent, countRequest),
          },
        });
      }
    }
  }

  dispose(): void {
    this.usage.dispose();
    this.quota.dispose();
  }
}
