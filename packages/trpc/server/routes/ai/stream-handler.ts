import type { Request, Response } from "express";
import { logger } from "@repo/logger";
import { AiError, isAiError, describeError } from "@repo/services/ai";

import { aiService, userService } from "../../services";
import { ACCESS_TOKEN_COOKIE, getCookie } from "../../utils/cookie";

/**
 * POST /ai/form/stream — Server-Sent Events over a POST (consumed with
 * fetch + ReadableStream, since EventSource can't POST or send a body).
 *
 * Order of defences (cheapest first):
 *   1. per-IP throttle          (in-memory, before any crypto/DB work)
 *   2. same-site check          (Origin must match WEB_URL when present)
 *   3. content-type check       (application/json — forces a CORS preflight cross-origin)
 *   4. authentication           (access-token cookie, verified server-side)
 *   5. everything else          (validation, plan limits, quota, budgets, single-flight,
 *                                idempotency) inside AiFormEngine.start — all of it
 *                                BEFORE any streaming header is sent, so rejections
 *                                are ordinary JSON responses with real HTTP statuses.
 */

const HEARTBEAT_MS = 15_000;

function allowedOrigins(): Set<string> {
  const web = (process.env.WEB_URL ?? "http://localhost:3000").trim();
  const set = new Set<string>();
  try {
    set.add(new URL(web).origin);
  } catch {
    /* misconfigured WEB_URL: nothing will match, requests with an Origin are rejected */
  }
  return set;
}

function sendJsonError(res: Response, err: AiError) {
  if (err.retryAfterSec) res.setHeader("Retry-After", String(err.retryAfterSec));
  res.status(err.httpStatus).json({
    error: {
      code: err.code,
      message: err.userMessage,
      retryAfterSec: err.retryAfterSec,
      details: err.details,
    },
  });
}

export async function aiStreamHandler(req: Request, res: Response): Promise<void> {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  try {
    // 1. per-IP throttle
    aiService.checkIp(ip);

    // 2. same-site check
    const origin = req.headers.origin;
    if (origin && !allowedOrigins().has(origin)) {
      logger.warn("ai.origin_rejected", { ip, origin: String(origin).slice(0, 100) });
      throw new AiError("FORBIDDEN_ORIGIN");
    }

    // 3. content type
    if (!req.is("application/json")) {
      throw new AiError("INVALID_REQUEST", "Content-Type must be application/json");
    }

    // 4. authentication
    const token = getCookie(req, ACCESS_TOKEN_COOKIE);
    if (!token) throw new AiError("UNAUTHENTICATED");
    let userId: string;
    try {
      userId = (await userService.verifyAndDecodeAccessToken(token)).id;
    } catch {
      // 401 (not 403) so the web client knows to try a silent token refresh once.
      throw new AiError("UNAUTHENTICATED", "Access token invalid or expired", {
        userMessage: "Your session has expired, please sign in again",
      });
    }

    // 5. cancellation wiring — abort the upstream model call the moment the browser goes away.
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    const session = await aiService.startStream(userId, req.body, controller.signal);

    // Past this line the response is a stream; errors travel as `error` events.
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // stop nginx-style proxies from buffering the stream
    res.flushHeaders();

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(": keep-alive\n\n");
    }, HEARTBEAT_MS);

    try {
      await session.run((evt) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(`event: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`);
      });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  } catch (e) {
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    if (isAiError(e)) {
      sendJsonError(res, e);
      return;
    }
    logger.error("ai.stream_handler_error", { err: describeError(e) });
    sendJsonError(res, new AiError("INTERNAL"));
  }
}
