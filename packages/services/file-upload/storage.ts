// packages/services/file-upload/storage.ts
//
// Storage adapter. Everything provider-specific lives here; the upload service only talks to the
// StorageProvider interface (and tests swap in an in-memory fake). Provider: Cloudinary.
//
//  - Objects are stored as resource_type "raw" with a PRIVATE delivery type ("authenticated", or
//    "private" via CLOUDINARY_DELIVERY_TYPE). There is no public URL for them: reads go through
//    short-lived, signed download URLs minted on demand.
//  - The browser uploads straight to Cloudinary using a signature minted here. Every parameter of
//    the upload (public_id, type, overwrite, timestamp) is part of the signature, so a client can
//    neither change the key, make the file public, nor overwrite an object after it was checked.
//  - The API secret never leaves this file / the server.
//  - probe() runs a complete upload -> inspect -> delete round trip from the SERVER so a
//    misconfigured account shows Cloudinary's real error message (see the "Test storage" button).

import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../env";

export type DeliveryType = "authenticated" | "private";

export interface SignedUpload {
  /** Where the browser POSTs (multipart/form-data) the file. */
  url: string;
  /** Extra form fields to send together with the `file` part, exactly as given. */
  fields: Record<string, string>;
  /** Safe generated filename with the canonical extension required by Cloudinary raw assets. */
  fileName: string;
}

export interface StoredObjectInfo {
  bytes: number;
}

export interface ProbeStep {
  name: string;
  ok: boolean;
  detail: string;
}
export interface ProbeResult {
  type: DeliveryType;
  ok: boolean;
  steps: ProbeStep[];
}

export interface StorageProvider {
  isConfigured(): boolean;
  /** Mints a one-time upload signature for exactly this object key. */
  signUpload(key: string): SignedUpload;
  /** Size of the stored object, or null if it doesn't exist (yet). */
  head(key: string): Promise<StoredObjectInfo | null>;
  /** The first `length` bytes of the stored object, or null if missing. */
  readHead(key: string, length: number): Promise<Uint8Array | null>;
  /** Deletes the object. Resolves true when it is gone (including "was never there"). */
  remove(key: string): Promise<boolean>;
  /** Short-lived download link that forces a download with the given filename. */
  downloadUrl(key: string, opts: { filename: string; ttlSec: number }): string;
  /** Self-test against the real account, for one delivery type. */
  probe(type: DeliveryType): Promise<ProbeResult>;
}

const RESOURCE_TYPE = "raw" as const;

// 1x1 transparent PNG (used by the self-test)
const PROBE_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

class CloudinaryStorage implements StorageProvider {
  private configured = false;

  private ensure() {
    if (this.configured) return;
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      signature_algorithm: env.CLOUDINARY_SIGNATURE_ALGORITHM,
      secure: true,
    });
    this.configured = true;
  }

  public isConfigured() {
    return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  }

  public signUpload(key: string, type: DeliveryType = env.CLOUDINARY_DELIVERY_TYPE): SignedUpload {
    this.ensure();
    const timestamp = Math.floor(Date.now() / 1000);
    const extension = key.slice(key.lastIndexOf(".") + 1);
    const publicId = key.slice(0, -(extension.length + 1));
    const fileName = key.slice(key.lastIndexOf("/") + 1);
    // Everything in here is covered by the signature. Cloudinary rejects the upload if the browser
    // changes (or adds) any of these values.
    const signed: Record<string, string> = {
      overwrite: "false",
      public_id: publicId,
      timestamp: String(timestamp),
      type,
      unique_filename: "false",
    };
    const signature = cloudinary.utils.api_sign_request(signed, env.CLOUDINARY_API_SECRET!);

    return {
      url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${RESOURCE_TYPE}/upload`,
      fields: { ...signed, api_key: env.CLOUDINARY_API_KEY!, signature },
      fileName,
    };
  }

  public async head(key: string, type: DeliveryType = env.CLOUDINARY_DELIVERY_TYPE): Promise<StoredObjectInfo | null> {
    this.ensure();
    try {
      const res = (await cloudinary.api.resource(key, {
        resource_type: RESOURCE_TYPE,
        type,
      })) as { bytes?: number };
      return typeof res.bytes === "number" ? { bytes: res.bytes } : null;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  public async readHead(
    key: string,
    length: number,
    type: DeliveryType = env.CLOUDINARY_DELIVERY_TYPE,
  ): Promise<Uint8Array | null> {
    const url = this.downloadUrl(key, { filename: "check", ttlSec: 120 }, type);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new Error(`Storage read failed (${res.status})`);

      // Read only the first chunk(s); the rest of the file is never pulled through our server.
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < length) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
      }
      await reader.cancel().catch(() => undefined);

      const out = new Uint8Array(Math.min(total, length));
      let offset = 0;
      for (const c of chunks) {
        const take = Math.min(c.length, out.length - offset);
        out.set(c.subarray(0, take), offset);
        offset += take;
        if (offset >= out.length) break;
      }
      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  public async remove(key: string, type: DeliveryType = env.CLOUDINARY_DELIVERY_TYPE): Promise<boolean> {
    this.ensure();
    const res = (await cloudinary.uploader.destroy(key, {
      resource_type: RESOURCE_TYPE,
      type,
      invalidate: true,
    })) as { result?: string };
    return res.result === "ok" || res.result === "not found";
  }

  public downloadUrl(
    key: string,
    opts: { filename: string; ttlSec: number },
    type: DeliveryType = env.CLOUDINARY_DELIVERY_TYPE,
  ): string {
    this.ensure();
    return cloudinary.utils.private_download_url(key, "", {
      resource_type: RESOURCE_TYPE,
      type,
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + opts.ttlSec,
    });
  }

  /**
   * Upload a 1x1 PNG from the server with exactly the parameters the browser would use, then read
   * it back and delete it. Every step reports Cloudinary's own message, which is what you need when
   * the browser only shows "403".
   */
  public async probe(type: DeliveryType): Promise<ProbeResult> {
    const steps: ProbeStep[] = [];
    const done = (ok: boolean): ProbeResult => ({ type, ok, steps });
    const key = `dockett/probe/${randomUUID()}.png`;

    if (!this.isConfigured()) {
      steps.push({ name: "configuration", ok: false, detail: "CLOUDINARY_* variables are not set on the API server." });
      return done(false);
    }
    steps.push({ name: "configuration", ok: true, detail: `cloud "${env.CLOUDINARY_CLOUD_NAME}", signature ${env.CLOUDINARY_SIGNATURE_ALGORITHM}` });

    // 1. upload (the step that returned 403 in the browser)
    let uploaded = false;
    try {
      const signed = this.signUpload(key, type);
      const form = new FormData();
      for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
      form.append("file", new Blob([PROBE_PNG], { type: "image/png" }), signed.fileName);
      const res = await fetch(signed.url, { method: "POST", body: form });
      const text = await res.text();
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { error?: { message?: string } };
        if (j.error?.message) message = j.error.message;
      } catch {
        /* keep raw text */
      }
      uploaded = res.ok;
      steps.push({ name: "upload", ok: res.ok, detail: res.ok ? `accepted (${res.status})` : `HTTP ${res.status}: ${message}` });
    } catch (err) {
      steps.push({ name: "upload", ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
    if (!uploaded) return done(false);

    // 2. inspect (Admin API) 3. read the first bytes (signed download) 4. delete
    try {
      const info = await this.head(key, type);
      steps.push({ name: "inspect (Admin API)", ok: !!info, detail: info ? `${info.bytes} bytes` : "object not found" });
    } catch (err) {
      steps.push({ name: "inspect (Admin API)", ok: false, detail: errMessage(err) });
    }
    try {
      const head = await this.readHead(key, 16, type);
      const png = !!head && head[0] === 0x89 && head[1] === 0x50;
      steps.push({ name: "signed download", ok: png, detail: png ? "PNG signature read back" : "could not read the object" });
    } catch (err) {
      steps.push({ name: "signed download", ok: false, detail: errMessage(err) });
    }
    try {
      const gone = await this.remove(key, type);
      steps.push({ name: "delete", ok: gone, detail: gone ? "removed" : "not removed" });
    } catch (err) {
      steps.push({ name: "delete", ok: false, detail: errMessage(err) });
    }
    return done(steps.every((s) => s.ok));
  }
}

function errMessage(err: unknown): string {
  const e = err as { message?: string; error?: { message?: string; http_code?: number } } | undefined;
  return e?.error?.message ?? e?.message ?? String(err);
}

function isNotFound(err: unknown): boolean {
  const e = err as { http_code?: number; error?: { http_code?: number } } | undefined;
  return e?.http_code === 404 || e?.error?.http_code === 404;
}

export const storage: StorageProvider = new CloudinaryStorage();
