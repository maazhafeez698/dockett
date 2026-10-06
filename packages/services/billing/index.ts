import { logger } from "@repo/logger";

import { getBillingConfig } from "./config";
import { invalidateEntitlements, getUserPlan, countPublishedForms } from "./enforce";
import { PaddleClient } from "./paddle-client";
import { PLANS, PLAN_ORDER, type PlanDefinition } from "./plans";
import { signCheckoutBinding, verifyPaddleSignature } from "./signature";
import { applyPaddleEvent, findSubscription } from "./store";
import type { PaddleEvent } from "./webhook-parse";

export * from "./errors";
export * from "./plans";
export {
  getUserPlan,
  invalidateEntitlements,
  assertTemplateAllowed,
  templateForOwner,
  withPublishLimit,
  isFormSuspended,
  isResponseLimitReached,
  withResponseQuota,
  countPublishedForms,
} from "./enforce";


function publicPlan(p: PlanDefinition, yearlyAvailable: boolean) {
  return {
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    priceMonthlyUsd: p.priceMonthlyUsd,
    priceYearlyUsd: p.key === "premium" && !yearlyAvailable ? null : p.priceYearlyUsd,
    purchasable: p.purchasable,
    contactSales: p.contactSales,
    maxActiveForms: p.limits.maxActiveForms,
    maxResponsesPerFormPerMonth: p.limits.maxResponsesPerFormPerMonth,
    premiumTemplates: p.features.premiumTemplates,
    highlights: p.highlights,
  };
}

/**
 * Facade the tRPC layer talks to (same pattern as FormService, AiService).
 * Config is read lazily so a missing Paddle variable disables payments, never the API.
 */
export default class BillingService {
  private _client?: PaddleClient;
  private get client() {
    return (this._client ??= new PaddleClient(getBillingConfig()));
  }

  /** The current plan plus everything the billing page and upgrade prompts need. */
  public async getOverview(userId: string, email: string) {
    const cfg = getBillingConfig();
    const plan = await getUserPlan(userId);
    const sub = await findSubscription(userId);
    const activeForms = await countPublishedForms(userId);
    const limit = plan.limits.maxActiveForms;

    const yearlyAvailable = !!cfg.prices.premiumYearly;
    const paddleManaged = !!sub && sub.source === "PADDLE" && !!sub.paddleCustomerId && !!sub.paddleSubscriptionId;

    return {
      plan: publicPlan(plan, yearlyAvailable),
      plans: PLAN_ORDER.map((k) => publicPlan(PLANS[k], yearlyAvailable)),
      subscription: sub
        ? {
            status: sub.status,
            billingCycle: sub.billingCycle,
            currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            graceUntil: sub.graceUntil ? sub.graceUntil.toISOString() : null,
            managedByPaddle: paddleManaged,
          }
        : null,
      usage: {
        activeForms,
        suspendedForms: limit === null ? 0 : Math.max(0, activeForms - limit),
      },
      checkout: {
        available: cfg.configured,
        environment: cfg.environment,
        clientToken: cfg.configured ? (cfg.clientToken ?? null) : null,
        premiumMonthlyPriceId: cfg.configured ? (cfg.prices.premiumMonthly ?? null) : null,
        premiumYearlyPriceId: cfg.configured ? (cfg.prices.premiumYearly ?? null) : null,
        customer: { email },
        // Signed so the webhook can trust which account a purchase belongs to.
        customData: cfg.configured && cfg.webhookSecret ? { userId, sig: signCheckoutBinding(userId, cfg.webhookSecret) } : null,
      },
    };
  }

  /** Paddle-hosted portal: update card, see invoices, cancel. */
  public async createPortalSession(userId: string) {
    const cfg = getBillingConfig();
    if (!cfg.configured) throw new Error("Payments aren't set up yet");
    const sub = await findSubscription(userId);
    if (!sub || sub.source !== "PADDLE" || !sub.paddleCustomerId || !sub.paddleSubscriptionId) {
      throw new Error("There's no active subscription to manage");
    }
    const links = await this.client.createPortalSession(sub.paddleCustomerId, [sub.paddleSubscriptionId]);
    return { url: links.overview, cancelUrl: links.cancel ?? null, updatePaymentUrl: links.updatePaymentMethod ?? null };
  }

  /**
   * Verifies and applies a Paddle webhook. Throws on a bad signature (→ 400 so
   * Paddle doesn't retry garbage) and on processing failure (→ 500 so it does retry).
   */
  public async handleWebhook(rawBody: string, signatureHeader: string | undefined): Promise<{ outcome: string }> {
    const cfg = getBillingConfig();
    if (!cfg.configured || !cfg.webhookSecret) throw new WebhookError(503, "Billing is not configured");

    const check = verifyPaddleSignature(rawBody, signatureHeader, cfg.webhookSecret, { toleranceSec: cfg.webhookToleranceSec });
    if (!check.ok) {
      logger.warn("billing.webhook_rejected", { reason: check.reason });
      throw new WebhookError(400, "Invalid signature");
    }

    let event: PaddleEvent;
    try {
      event = JSON.parse(rawBody) as PaddleEvent;
      if (typeof event.event_id !== "string" || typeof event.event_type !== "string") throw new Error("shape");
    } catch {
      throw new WebhookError(400, "Malformed event");
    }

    const { outcome, userId } = await applyPaddleEvent(event, cfg);
    if (userId) invalidateEntitlements(userId);
    logger.info("billing.webhook_processed", { eventType: event.event_type, outcome, eventId: event.event_id });
    return { outcome };
  }
}

export class WebhookError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

