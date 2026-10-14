// apps/web/lib/ai-stream.ts
//
// Client for POST /ai/form/stream (Server-Sent Events over fetch).
// Mirrors AiStreamEvent in packages/services/ai/engine.ts.
//
// Rules this file enforces so callers don't have to:
//  - never auto-retries a generation (each retry could be a second paid call)
//  - the ONE exception is a 401 → silent token refresh → replay of the same
//    request id, which is safe because the server rejected it before admission
//  - a stream that ends without `done` or `error` is reported as an error
//  - cancellation via AbortSignal is silent (resolves, no error)

import { getApiBaseUrl, refreshSession } from "~/trpc/create-client";

export type AiFieldType =
  | "TEXT"
  | "EMAIL"
  | "NUMBER"
  | "YES_NO"
  | "LONG_TEXT"
  | "DROPDOWN"
  | "RADIO_GROUP"
  | "MULTI_SELECT"
  | "CHECKBOX_GROUP"
  | "DATE"
  | "RATING";

export interface AiDraftField {
  label: string;
  type: AiFieldType;
  description?: string;
  placeholder?: string;
  isRequired: boolean;
  config?: { options?: string[]; maxLength?: number; max?: number } | null;
}

export type AiTemplate =
  | "CORPORATE"
  | "SURVEY"
  | "EDUCATION"
  | "DEVELOPER"
  | "RETRO"
  | "INVITATION"
  | "TICKET"
  | "LANDING"
  | "CLASSIC";

export interface AiDraft {
  title: string;
  description?: string;
  template: AiTemplate;
  submissionLayout: "ONE_AT_A_TIME" | "ALL_AT_ONCE";
  fields: AiDraftField[];
}

/** What the UI shows: credits (tokens) consumed in the current window. */
export interface AiCredits {
  /** 0-100 — "90% credits consumed". */
  percentUsed: number;
  limitReached: boolean;
  /** ISO time the credits reset; null until the usage limit is reached. */
  resetsAt: string | null;
  tokensUsed: number;
  tokensLimit: number;
}

export type AiIntent = "BUILD" | "CLARIFY" | "CHAT" | "OFF_TOPIC";

export interface AiChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiStreamRequest {
  requestId: string;
  mode: "NEW_FORM" | "ADD_FIELDS";
  formId?: string;
  prompt: string;
  history: AiChatTurn[];
  currentDraft?: AiDraft;
}

export interface AiStreamError {
  code: string;
  message: string;
  retryAfterSec?: number;
  credits?: AiCredits;
}

export interface AiStreamHandlers {
  onMeta?(d: { requestId: string; credits: AiCredits }): void;
  onStatus?(d: { phase: "retrying" | "fallback"; message: string }): void;
  onReply?(delta: string): void;
  onField?(index: number, field: AiDraftField): void;
  onReset?(reason: string): void;
  onDone?(d: {
    requestId: string;
    intent: AiIntent;
    reply: string;
    draft: AiDraft | null;
    credits: AiCredits;
  }): void;
  onError?(e: AiStreamError): void;
}

const NETWORK_ERROR: AiStreamError = {
  code: "NETWORK",
  message: "Couldn't reach the server. Check your connection and try again.",
};

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for very old browsers / insecure contexts.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function post(body: AiStreamRequest, signal: AbortSignal): Promise<Response> {
  return fetch(`${getApiBaseUrl()}/ai/form/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
}

async function readJsonError(res: Response): Promise<AiStreamError> {
  try {
    const j = (await res.json()) as { error?: Partial<AiStreamError> };
    if (j.error?.code) {
      return {
        code: j.error.code,
        message: j.error.message ?? "Something went wrong. Please try again.",
        retryAfterSec: j.error.retryAfterSec,
      };
    }
  } catch {
    /* not JSON (e.g. a proxy error page) */
  }
  return { code: `HTTP_${res.status}`, message: "Something went wrong. Please try again." };
}

function dispatch(name: string, raw: string, h: AiStreamHandlers): "done" | "error" | null {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null; // ignore garbled event; the stream-end check catches real trouble
  }
  switch (name) {
    case "meta":
      h.onMeta?.(data);
      return null;
    case "status":
      h.onStatus?.(data);
      return null;
    case "reply":
      h.onReply?.(data.delta);
      return null;
    case "field":
      h.onField?.(data.index, data.field);
      return null;
    case "reset":
      h.onReset?.(data.reason);
      return null;
    case "done":
      h.onDone?.(data);
      return "done";
    case "error":
      h.onError?.(data);
      return "error";
    default:
      return null;
  }
}

/**
 * Runs one generation. Resolves when the stream finishes (for any reason);
 * outcomes are delivered through handlers, so this never rejects except on
 * programmer error.
 */
export async function streamAiForm(
  body: AiStreamRequest,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  try {
    let res = await post(body, signal);
    if (res.status === 401 && (await refreshSession())) res = await post(body, signal);

    if (!res.ok) {
      handlers.onError?.(await readJsonError(res));
      return;
    }
    if (!res.body) {
      handlers.onError?.(NETWORK_ERROR);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let eventName = "message";
    let dataLines: string[] = [];
    let terminal: "done" | "error" | null = null;

    const flush = () => {
      if (dataLines.length)
        terminal = dispatch(eventName, dataLines.join("\n"), handlers) ?? terminal;
      eventName = "message";
      dataLines = [];
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = pending.indexOf("\n")) !== -1) {
          const line = pending.slice(0, nl).replace(/\r$/, "");
          pending = pending.slice(nl + 1);
          if (line === "") flush();
          else if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
        }
      }
      flush();
    } finally {
      reader.cancel().catch(() => undefined);
    }

    if (!terminal)
      handlers.onError?.({
        code: "STREAM_ENDED",
        message: "The connection dropped before I finished. Please try again.",
      });
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
    handlers.onError?.(NETWORK_ERROR);
  }
}
