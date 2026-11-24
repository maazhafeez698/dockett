import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import {
  serverRouter,
  createContext,
  aiStreamHandler,
  paddleWebhookHandler,
} from "@repo/trpc/server";

import { env } from "./env";
import cookieParser from "cookie-parser";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY);
app.disable("x-powered-by");
const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "Dockett OpenAPI",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
});

app.use(
  cors({
    origin: env.WEB_URL,
    credentials: true,
  }),
);

app.use(cookieParser());

// AI form generation streams over SSE, so it is not a tRPC procedure.
// Mounted before the global JSON parser so it can carry its own, tighter body cap.
app.post("/ai/form/stream", express.json({ limit: "128kb" }), aiStreamHandler);

// Paddle webhooks. The signature is computed over the exact bytes Paddle sends, so this
// route needs the RAW body (not parsed JSON). It must stay above the global express.json() below.
app.post(
  "/billing/paddle/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  paddleWebhookHandler,
);

// Malformed / oversized bodies on the AI route get the same JSON error shape as every other AI rejection.
app.use(
  "/ai/form/stream",
  (
    err: { status?: number; type?: string },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) return next(err);
    const tooBig = err?.status === 413 || err?.type === "entity.too.large";
    return res.status(tooBig ? 413 : 400).json({
      error: {
        code: tooBig ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
        message: tooBig
          ? "That request is too large."
          : "That request didn't look right. Please try again.",
      },
    });
  },
);

app.use(express.json());

app.get("/", (req, res) => {
  return res.json({ message: "Dockett API is up and running..." });
});

app.get("/health", (req, res) => {
  return res.json({ message: "Dockett API is healthy", healthy: true });
});

logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
app.get("/openapi.json", (req, res) => {
  return res.json(openApiDocument);
});

logger.debug(`docs: ${env.BASE_URL}/docs`);
app.use("/docs", apiReference({ url: "/openapi.json" }));

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
    onError({ error, path }) {
      if (
        error.code === "INTERNAL_SERVER_ERROR" ||
        /failed query:|sqlstate|drizzle|postgres|constraint|econn|etimedout|cannot (?:read|set) properties/i.test(
          error.message,
        )
      ) {
        logger.error("tRPC request failed", {
          path,
          code: error.code,
          message: error.message,
          stack: error.stack,
        });
      }
    },
  }),
);

// Keep parser and other Express-level failures on the same safe, predictable
// JSON contract as tRPC. Express's default handler can include implementation
// details in development and is not suitable as a public API response.
app.use(
  (
    error: { status?: number; type?: string },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) return next(error);

    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500;
    if (status === 500) {
      logger.error("Unhandled HTTP request failure", { error });
    }

    return res.status(status).json({
      error: {
        message:
          status === 413
            ? "That request is too large."
            : status === 400
              ? "We couldn't process that request. Please check it and try again."
              : "We couldn't complete that request. Please try again.",
      },
    });
  },
);

export default app;
