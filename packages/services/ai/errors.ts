/**
 * Error model for the AI feature.
 *
 * Two layers, on purpose:
 *  - `AiError`       — what the *user-facing layer* deals in. Carries a stable
 *                      machine `code`, a friendly `userMessage`, and an HTTP
 *                      status for errors raised before streaming starts.
 *  - `ProviderError` — what a *model provider adapter* throws. Carries a
 *                      `kind` the orchestrator uses to decide retry vs.
 *                      fallback vs. give up. Never shown to users as-is.
 */

export type AiErrorCode =
  | "AI_DISABLED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN_ORIGIN"
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "CAPACITY_REACHED"
  | "DUPLICATE_REQUEST"
  | "REQUEST_IN_PROGRESS"
  | "FORM_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_RESPONSE"
  | "CONTENT_BLOCKED"
  | "CANCELLED"
  | "INTERNAL";

const HTTP_STATUS: Record<AiErrorCode, number> = {
  AI_DISABLED: 503,
  UNAUTHENTICATED: 401,
  FORBIDDEN_ORIGIN: 403,
  INVALID_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  CAPACITY_REACHED: 503,
  DUPLICATE_REQUEST: 409,
  REQUEST_IN_PROGRESS: 409,
  FORM_NOT_FOUND: 404,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_TIMEOUT: 504,
  INVALID_RESPONSE: 502,
  CONTENT_BLOCKED: 422,
  CANCELLED: 499,
  INTERNAL: 500,
};

const DEFAULT_USER_MESSAGE: Record<AiErrorCode, string> = {
  AI_DISABLED: "AI form building is switched off right now. You can still build forms by hand.",
  UNAUTHENTICATED: "Please sign in to use the AI form builder.",
  FORBIDDEN_ORIGIN: "This request came from somewhere we don't recognise.",
  INVALID_REQUEST: "That request didn't look right. Please try again.",
  PAYLOAD_TOO_LARGE: "That message is too long. Try shortening it.",
  RATE_LIMITED: "Whoa, easy there! Give it a few seconds and try again.",
  QUOTA_EXCEEDED: "Limit reached.",
  CAPACITY_REACHED:
    "The AI builder is at full capacity right now (it runs on a free tier). Please try again a little later.",
  DUPLICATE_REQUEST: "That message was already sent.",
  REQUEST_IN_PROGRESS: "I'm still working on your last message — hang tight!",
  FORM_NOT_FOUND: "We couldn't find that form.",
  PROVIDER_UNAVAILABLE:
    "The AI service is having a moment. That didn't use up any of your credits — please try again.",
  PROVIDER_TIMEOUT:
    "That took too long, so I stopped. That didn't use up any of your credits — please try again.",
  INVALID_RESPONSE:
    "I couldn't put together a valid form that time. That didn't use up any of your credits — please try again.",
  CONTENT_BLOCKED: "I can't help with that one. Try describing a different form.",
  CANCELLED: "Stopped.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

export interface AiErrorOptions {
  userMessage?: string;
  retryAfterSec?: number;
  /** Safe, structured extras (e.g. quota reset time). Never secrets. */
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly httpStatus: number;
  readonly userMessage: string;
  readonly retryAfterSec?: number;
  readonly details?: Record<string, unknown>;

  constructor(code: AiErrorCode, message?: string, opts: AiErrorOptions = {}) {
    super(message ?? DEFAULT_USER_MESSAGE[code]);
    this.name = "AiError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.userMessage = opts.userMessage ?? DEFAULT_USER_MESSAGE[code];
    this.retryAfterSec = opts.retryAfterSec;
    this.details = opts.details;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export function isAiError(e: unknown): e is AiError {
  return e instanceof AiError;
}

/**
 * kind → orchestrator policy
 *  transient        5xx / network / stream cut  → retry same model once, then fall back
 *  rate_limit       429 from provider           → do NOT hammer; fall back immediately
 *  timeout          our own timer fired         → treated like transient
 *  auth             401/403 (bad/blocked key)   → fall back; log loudly (config bug)
 *  bad_request      400/404/etc. (schema/model) → fall back; log loudly (config bug)
 *  invalid_response 200 but unusable output     → fall back (deterministic-ish)
 *  content_blocked  safety filter               → stop; retrying can't help
 */
export type ProviderErrorKind =
  | "transient"
  | "rate_limit"
  | "timeout"
  | "auth"
  | "bad_request"
  | "invalid_response"
  | "content_blocked";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  /** True once any model output had been received when this failure hit. */
  outputStarted: boolean;

  constructor(
    kind: ProviderErrorKind,
    message: string,
    opts: { status?: number; retryAfterMs?: number; outputStarted?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.outputStarted = opts.outputStarted ?? false;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

/** Log-safe error summary: bounded length, no stack, no payloads. */
export function describeError(e: unknown): { name: string; message: string; code?: string } {
  if (e instanceof AiError) return { name: e.name, message: scrub(e.message), code: e.code };
  if (e instanceof ProviderError)
    return { name: e.name, message: scrub(e.message), code: `${e.kind}${e.status ? `:${e.status}` : ""}` };
  if (e instanceof Error) return { name: e.name, message: scrub(e.message) };
  return { name: "NonError", message: scrub(String(e)) };
}

/** Strips anything shaped like a credential and bounds the length. */
export function scrub(text: string, max = 300): string {
  return text
    .replace(/(api[_-]?key|authorization|bearer|token|secret)(["'\s:=]+)[^\s"',}]+/gi, "$1$2[redacted]")
    .replace(/\b(AIza|AQ\.|sk-|gsk_)[A-Za-z0-9._\-]{8,}/g, "[redacted]")
    .slice(0, max);
}
