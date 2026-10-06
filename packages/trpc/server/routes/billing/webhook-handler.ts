import type { Request, Response } from "express";
import { logger } from "@repo/logger";
import { WebhookError } from "@repo/services/billing";

import { billingService } from "../../services";

/**
 * POST /billing/paddle/webhook — called by Paddle's servers, never by browsers.
 *
 * Mounted with express.raw() BEFORE the global JSON parser (see apps/api/src/server.ts) because the
 * signature is computed over the exact bytes Paddle sent; re-serialised JSON would never match.
 * No cookie auth / Origin check here: the HMAC signature IS the authentication.
 *
 *   2xx  event handled (or deliberately ignored) — Paddle stops retrying
 *   400  bad signature / malformed — retrying can't help
 *   5xx  our failure — Paddle retries with backoff for days, so a transient DB error loses nothing
 */
export async function paddleWebhookHandler(req: Request, res: Response): Promise<void> {
  const body = req.body;
  if (!Buffer.isBuffer(body)) {
    res.status(400).json({ error: "Expected a raw JSON body" });
    return;
  }

  try {
    const header = req.header("paddle-signature") ?? undefined;
    const { outcome } = await billingService.handleWebhook(body.toString("utf8"), header);
    res.status(200).json({ ok: true, outcome });
  } catch (error) {
    if (error instanceof WebhookError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error("billing.webhook_failed", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
