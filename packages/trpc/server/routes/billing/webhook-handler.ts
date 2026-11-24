import type { Request, Response } from "express";
import { logger } from "@repo/logger";
import { WebhookError } from "@repo/services/billing";

import { billingService } from "../../services";

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
