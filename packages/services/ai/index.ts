import { logger } from "@repo/logger";
import { db, and, asc, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";

import { getUserPlan } from "@repo/services/billing";
import { getAiConfig } from "./config";
import { AiError } from "./errors";
import { SlidingWindowLimiter } from "./resilience";
import { AiFormEngine, type AiSession, type ExistingFormContext } from "./engine";
import { applyDraftToForm, saveDraftAsForm } from "./save";
import { PostgresUsageStore } from "./usage-store.postgres";
import type { AiLogger } from "./logging";
import type { FieldConfig } from "../form-field/model";

export * from "./errors";
export type { AiStreamEvent, AiSession } from "./engine";
export type { UsageSummary } from "./usage";

const aiLogger: AiLogger = {
  debug: (m, meta) => logger.debug(m, meta),
  info: (m, meta) => logger.info(m, meta),
  warn: (m, meta) => logger.warn(m, meta),
  error: (m, meta) => logger.error(m, meta),
};

async function loadForm(userId: string, formId: string): Promise<ExistingFormContext | null> {
  const forms = await db
    .select({ title: formsTable.title })
    .from(formsTable)
    .where(and(eq(formsTable.id, formId), eq(formsTable.createdBy, userId)));
  const form = forms[0];
  if (!form) return null;

  const fields = await db
    .select({
      label: formFieldsTable.label,
      type: formFieldsTable.type,
      isRequired: formFieldsTable.isRequired,
      config: formFieldsTable.config,
    })
    .from(formFieldsTable)
    .where(eq(formFieldsTable.formId, formId))
    .orderBy(asc(formFieldsTable.index));

  return {
    title: form.title,
    fields: fields
      .flatMap((f) => {
        if (f.type === "PASSWORD") return [];
        return [{
          label: f.label,
          type: f.type,
          isRequired: f.isRequired,
          config: (f.config as FieldConfig) ?? null,
        }];
      }),
  };
}

export default class AiService {
  private _engine?: AiFormEngine;
  private ipLimiter?: SlidingWindowLimiter;

  // Per-IP throttle, applied before authentication so junk traffic costs almost nothing.
  public checkIp(ip: string): void {
    this.ipLimiter ??= new SlidingWindowLimiter(60_000, 50_000);
    const r = this.ipLimiter.check(`ip:${ip}`, getAiConfig().ipLimit.perMinute);
    if (!r.allowed) {
      throw new AiError("RATE_LIMITED", "IP throttled", { retryAfterSec: Math.ceil(r.retryAfterMs / 1000) });
    }
  }

  get engine(): AiFormEngine {
    if (!this._engine) {
      const config = getAiConfig();
      this._engine = new AiFormEngine({
        config,
        store: new PostgresUsageStore(),
        logger: aiLogger,
        loadForm,
        // The user's subscription decides their AI limits and whether premium templates are on the table.
        resolveAccount: async (userId) => {
          const plan = await getUserPlan(userId);
          return { planKey: plan.aiPlanKey, premiumTemplates: plan.features.premiumTemplates };
        },
      });
      logger.info("ai.engine_ready", {
        enabled: config.enabled,
        chain: config.chain.map((c) => `${c.provider}:${c.model}`),
        tier: "gemini-free",
        windowMinutes: Math.round(config.plans.free!.windowMs / 60_000),
        freeTokensPerWindow: config.plans.free!.maxTokensPerWindow,
        dailyRequestBudget: config.budgets.globalDailyRequests,
      });
      if (!config.enabled) logger.warn("ai.disabled", { reason: config.disabledReason });
    }
    return this._engine;
  }

  public startStream(userId: string, body: unknown, signal: AbortSignal): Promise<AiSession> {
    return this.engine.start(userId, body, signal);
  }

  public getUsage(userId: string) {
    return this.engine.getUsageSummary(userId);
  }

  public saveDraftAsForm(userId: string, draft: unknown) {
    return saveDraftAsForm(userId, draft);
  }

  public applyDraftToForm(userId: string, formId: string, draft: unknown) {
    return applyDraftToForm(userId, formId, draft);
  }
}
