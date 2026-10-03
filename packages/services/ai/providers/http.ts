import { AiError, ProviderError, scrub } from "../errors";
import type { FetchLike } from "./types";

/**
 * Shared transport for streaming provider calls: timeouts, cancellation,
 * status→error classification and an SSE reader. Providers only translate
 * payloads; every reliability concern lives here so it is written (and
 * tested) once.
 */

type AbortReason = "client" | "first_byte" | "idle" | "attempt";

export class Watchdog {
  private ctrl = new AbortController();
  private _reason: AbortReason | null = null;
  private attemptTimer: ReturnType<typeof setTimeout>;
  private idleTimer: ReturnType<typeof setTimeout>;
  private readonly onClient = () => this.abort("client");

  constructor(
    private readonly clientSignal: AbortSignal,
    private readonly t: { firstByteMs: number; idleMs: number; attemptMs: number },
  ) {
    this.attemptTimer = setTimeout(() => this.abort("attempt"), t.attemptMs);
    this.idleTimer = setTimeout(() => this.abort("first_byte"), t.firstByteMs);
    if (clientSignal.aborted) this.abort("client");
    else clientSignal.addEventListener("abort", this.onClient, { once: true });
  }

  get signal(): AbortSignal {
    return this.ctrl.signal;
  }
  get reason(): AbortReason | null {
    return this._reason;
  }

  /** Call whenever bytes arrive: switches from first-byte to idle deadline. */
  touch(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.abort("idle"), this.t.idleMs);
  }

  private abort(reason: AbortReason): void {
    if (this._reason) return;
    this._reason = reason;
    this.ctrl.abort();
  }

  dispose(): void {
    clearTimeout(this.attemptTimer);
    clearTimeout(this.idleTimer);
    this.clientSignal.removeEventListener("abort", this.onClient);
  }
}

export function classifyStatus(status: number): ProviderError["kind"] {
  if (status === 429) return "rate_limit";
  if (status === 408 || status === 425 || status >= 500) return "transient";
  if (status === 401 || status === 403) return "auth";
  return "bad_request";
}

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, Math.min(secs, 600)) * 1000;
  const date = Date.parse(h);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.min(date - Date.now(), 600_000));
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = (await res.text()).slice(0, 2000);
    try {
      const j = JSON.parse(text) as { error?: { message?: string; status?: string } | string; message?: string };
      const msg = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message);
      if (msg) return scrub(msg, 200);
    } catch {
      /* not JSON */
    }
    return scrub(text, 200);
  } catch {
    return "";
  }
}

/**
 * POSTs JSON and yields each SSE `data:` payload as a string.
 * Guarantees: the watchdog is disposed and the socket released on every
 * exit path (normal end, error, consumer stops early).
 */
export async function* postSse(opts: {
  fetchImpl: FetchLike;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  clientSignal: AbortSignal;
  timeouts: { firstByteMs: number; idleMs: number; attemptMs: number };
}): AsyncGenerator<string, void, void> {
  const wd = new Watchdog(opts.clientSignal, opts.timeouts);
  // Some runtimes/proxies leave a body read pending after abort(). Racing every
  // await against this promise guarantees our deadlines are enforced regardless.
  const aborted = new Promise<never>((_, reject) => {
    if (wd.signal.aborted) reject(new Error("aborted"));
    else wd.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  aborted.catch(() => undefined);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const failFromAbort = (cause: unknown): never => {
    if (wd.reason === "client") throw new AiError("CANCELLED", "Client cancelled the request");
    if (wd.reason) {
      throw new ProviderError("timeout", `Provider ${wd.reason.replace("_", "-")} timeout`, { cause });
    }
    throw new ProviderError("transient", `Network error: ${scrub(cause instanceof Error ? cause.message : String(cause), 120)}`, {
      cause,
    });
  };

  try {
    let res: Response;
    try {
      res = await Promise.race([
        opts.fetchImpl(opts.url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream", ...opts.headers },
          body: JSON.stringify(opts.body),
          signal: wd.signal,
        }),
        aborted,
      ]);
    } catch (err) {
      return failFromAbort(err);
    }

    if (!res.ok) {
      const message = await readErrorMessage(res);
      throw new ProviderError(classifyStatus(res.status), `HTTP ${res.status}${message ? `: ${message}` : ""}`, {
        status: res.status,
        retryAfterMs: parseRetryAfter(res),
      });
    }
    if (!res.body) throw new ProviderError("transient", "Provider returned an empty body", { status: res.status });

    reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let dataLines: string[] = [];

    while (true) {
      let read: ReadableStreamReadResult<Uint8Array>;
      try {
        read = await Promise.race([reader.read(), aborted]);
      } catch (err) {
        return failFromAbort(err);
      }
      if (read.done) break;
      wd.touch();
      pending += decoder.decode(read.value, { stream: true });

      let nl: number;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
        if (line === "") {
          if (dataLines.length) {
            yield dataLines.join("\n");
            dataLines = [];
          }
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^ /, ""));
        }
        // "event:", "id:", "retry:" and ":comment" lines are irrelevant to us.
      }
    }

    // Flush a final event that wasn't terminated by a blank line.
    const tail = pending.replace(/\r$/, "");
    if (tail.startsWith("data:")) dataLines.push(tail.slice(5).replace(/^ /, ""));
    if (dataLines.length) yield dataLines.join("\n");
  } finally {
    wd.dispose();
    // Fire-and-forget: awaiting cancel() on a wedged socket could hang the request we're trying to end.
    reader?.cancel().catch(() => undefined);
  }
}
