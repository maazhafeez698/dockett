import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureResult = { ok: true } | { ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" };

export function verifyPaddleSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  opts: { toleranceSec: number; nowMs?: number },
): SignatureResult {
  if (!header) return { ok: false, reason: "missing" };

  let ts: string | undefined;
  const hashes: string[] = [];
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "ts") ts = v;
    else if (k === "h1") hashes.push(v);
  }
  if (!ts || !/^\d+$/.test(ts) || hashes.length === 0) return { ok: false, reason: "malformed" };

  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - Number(ts)) > opts.toleranceSec) return { ok: false, reason: "stale" };

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  for (const h of hashes) {
    if (!/^[0-9a-f]{64}$/i.test(h)) continue;
    const given = Buffer.from(h, "hex");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

// Test/dev helper: builds a valid header for a body. 
export function signPaddleBody(rawBody: string, secret: string, tsSec = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac("sha256", secret).update(`${tsSec}:${rawBody}`).digest("hex");
  return `ts=${tsSec};h1=${h1}`;
}

export function signCheckoutBinding(userId: string, webhookSecret: string): string {
  return createHmac("sha256", `checkout-binding:${webhookSecret}`).update(userId).digest("hex").slice(0, 32);
}

export function verifyCheckoutBinding(userId: unknown, sig: unknown, webhookSecret: string): boolean {
  if (typeof userId !== "string" || typeof sig !== "string" || sig.length !== 32) return false;
  const expected = signCheckoutBinding(userId, webhookSecret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
