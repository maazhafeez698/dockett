import { createHmac, randomUUID } from "node:crypto";

import { db, and, eq, inArray, isNull, lt, or, sql } from "@repo/database";
import { fileUploadsTable } from "@repo/database/models/file-upload";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formsTable } from "@repo/database/models/form";
import { formVersionsTable } from "@repo/database/models/form-version";
import { verifyRespondentToken } from "@repo/services/form-respondent";
import { effectiveState } from "../form/publication";
import { ensurePublishedVersion } from "../form/ensure-version";
import { logger } from "@repo/logger";
import { assertFormOwnership } from "@repo/services/form";
import { isFormSuspended } from "@repo/services/billing";

import { env } from "../env";
import { UploadError } from "./errors";
import {
  ALL_FILE_KINDS,
  describeKinds,
  isFileKind,
  kindFromFilename,
  mimeCompatible,
  sanitizeDisplayName,
  sniffKind,
  FILE_KINDS,
  type FileKind,
} from "./kinds";
import { SlidingWindowLimiter } from "./rate-limit";
import { storage, type StorageProvider } from "./storage";
import {
  confirmUploadInput,
  createUploadInput,
  discardUploadInput,
  downloadUrlInput,
  type ConfirmUploadInputType,
  type CreateUploadInputType,
  type DiscardUploadInputType,
  type DownloadUrlInputType,
} from "./model";

export { UploadError } from "./errors";
export * from "./kinds";

const MB = 1024 * 1024;
const MIN = 60 * 1000;
const HEAD_BYTES = 8192;

// What a FILE_UPLOAD field's `config` means (validated again here; never trust stored JSON blindly). 
export interface FileFieldRules {
  accept: FileKind[];
  maxFiles: number;
  maxBytes: number;
}

export function fileFieldRules(config: unknown): FileFieldRules {
  const cfg = (config ?? {}) as { accept?: unknown; maxFiles?: unknown; maxSizeMB?: unknown };
  const accept = Array.isArray(cfg.accept) ? cfg.accept.filter(isFileKind) : [];
  const maxFiles =
    typeof cfg.maxFiles === "number" && Number.isInteger(cfg.maxFiles)
      ? Math.min(5, Math.max(1, cfg.maxFiles))
      : 1;
  const wantMb = typeof cfg.maxSizeMB === "number" && cfg.maxSizeMB > 0 ? cfg.maxSizeMB : env.UPLOAD_MAX_FILE_MB;
  // The environment limit is a hard ceiling no field setting can exceed.
  const maxBytes = Math.floor(Math.min(wantMb, env.UPLOAD_MAX_FILE_MB) * MB);
  return { accept: accept.length > 0 ? accept : [...ALL_FILE_KINDS], maxFiles, maxBytes };
}

// A file as stored inside a submission's answer value.
export interface StoredFileRef {
  id: string;
  name: string;
  size: number;
  kind: FileKind;
}

export function parseFileRefs(value: string | undefined | null): StoredFileRef[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is StoredFileRef =>
        !!r &&
        typeof r === "object" &&
        typeof (r as StoredFileRef).id === "string" &&
        typeof (r as StoredFileRef).name === "string",
    );
  } catch {
    return [];
  }
}

// limiters (per API instance)
const signLimiter = new SlidingWindowLimiter(env.UPLOAD_SIGN_LIMIT_PER_10_MIN, 10 * MIN);
const confirmLimiter = new SlidingWindowLimiter(env.UPLOAD_SIGN_LIMIT_PER_10_MIN * 2, 10 * MIN);
const testLimiter = new SlidingWindowLimiter(4, 10 * MIN);

function actorKeyFor(requesterId: string | undefined, ip: string | undefined): string {
  if (requesterId) return `u:${requesterId}`;
  // Never persist the raw address: keep a keyed hash, enough to rate-limit and count per visitor.
  const h = createHmac("sha256", env.JWT_SECRET).update(ip ?? "unknown").digest("hex").slice(0, 32);
  return `ip:${h}`;
}

function enforceRate(limiter: SlidingWindowLimiter, key: string) {
  const r = limiter.hit(key);
  if (!r.ok) {
    throw new UploadError(
      "RATE_LIMITED",
      `Too many uploads in a short time. Try again in ${r.retryAfterSec} seconds.`,
    );
  }
}

function formatMb(bytes: number) {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export default class FileUploadService {
  constructor(private readonly store: StorageProvider = storage) {}

  public get isConfigured() {
    return this.store.isConfigured();
  }

  // Authorise one upload and hand back a signature for exactly one random storage key. 
  public async createUpload(payload: CreateUploadInputType) {
    const input = await createUploadInput.parseAsync(payload);
    if (!this.store.isConfigured()) {
      throw new UploadError("NOT_CONFIGURED", "File uploads aren't set up for this form yet.");
    }

    const actorKey = actorKeyFor(input.requesterId, input.ip);
    enforceRate(signLimiter, actorKey);

    const form = (
      await db
        .select({
          id: formsTable.id,
          status: formsTable.status,
          submissionAccess: formsTable.submissionAccess,
          accessCode: formsTable.accessCode,
          respondentIdentity: formsTable.respondentIdentity,
          publishedVersionId: formsTable.publishedVersionId,
          closesAt: formsTable.closesAt,
          lastActivityAt: formsTable.lastActivityAt,
          closedReason: formsTable.closedReason,
          createdBy: formsTable.createdBy,
        })
        .from(formsTable)
        .where(eq(formsTable.id, input.formId))
    )[0];
    if (!form) throw new UploadError("NOT_FOUND", "Form not found.");
    const eff = effectiveState(form);

    const isOwner = !!input.requesterId && input.requesterId === form.createdBy;

    // Same gates as submitting: a visitor can't upload to a form they couldn't submit.
    if (!isOwner && eff.status !== "PUBLISHED") {
      throw new UploadError("FORBIDDEN", "This form isn't accepting responses right now.");
    }
    if (!isOwner && form.submissionAccess === "ACCESS_CODE") {
      const given = (input.accessCode ?? "").toUpperCase();
      if (!given || given !== (form.accessCode ?? "").toUpperCase()) {
        throw new UploadError("FORBIDDEN", "A valid access code is required.");
      }
    }
    if (form.respondentIdentity === "VERIFIED_EMAIL" && !verifyRespondentToken(input.respondentToken, form.id)) {
      throw new UploadError("FORBIDDEN", "Verify your email address before uploading files.");
    }
    if (eff.status === "PUBLISHED" && (await isFormSuspended(form.id, form.createdBy))) {
      throw new UploadError("FORBIDDEN", "This form is temporarily unavailable.");
    }

    // Respondents upload to the PUBLISHED version of the field, exactly what they were shown.
    if (eff.status === "PUBLISHED" && !form.publishedVersionId) {
      form.publishedVersionId = await ensurePublishedVersion(form.id);
    }
    const field = await this.resolveFileField(form.id, form.publishedVersionId, input.fieldId);
    if (!field || field.type !== "FILE_UPLOAD") {
      throw new UploadError("NOT_FOUND", "That upload field doesn't exist.");
    }

    const rules = fileFieldRules(field.config);

    // 1) extension 2) declared MIME. (3) the real bytes are checked in confirmUpload.)
    const kind = kindFromFilename(input.fileName);
    if (!kind || !rules.accept.includes(kind) || !mimeCompatible(kind, input.mimeType)) {
      throw new UploadError(
        "INVALID",
        `That file type isn't allowed. Allowed: ${describeKinds(rules.accept)}.`,
      );
    }
    if (input.size > rules.maxBytes) {
      throw new UploadError("INVALID", `That file is too large. The limit is ${formatMb(rules.maxBytes)}.`);
    }

    // quotas (database-backed, so they hold across API instances) 
    const twoHoursAgo = new Date(Date.now() - 120 * MIN);
    const [{ pending } = { pending: 0 }] = await db
      .select({ pending: sql<number>`count(*)::int` })
      .from(fileUploadsTable)
      .where(
        and(
          eq(fileUploadsTable.actorKey, actorKey),
          eq(fileUploadsTable.status, "PENDING"),
          sql`${fileUploadsTable.createdAt} > ${twoHoursAgo}`,
        ),
      );
    if (pending >= env.UPLOAD_MAX_PENDING_PER_ACTOR) {
      throw new UploadError("QUOTA", "Too many unfinished uploads. Please wait a moment and try again.");
    }

    const [{ waiting } = { waiting: 0 }] = await db
      .select({ waiting: sql<number>`count(*)::int` })
      .from(fileUploadsTable)
      .where(
        and(
          eq(fileUploadsTable.formId, form.id),
          inArray(fileUploadsTable.status, ["PENDING", "CONFIRMED"]),
        ),
      );
    if (waiting >= env.UPLOAD_FORM_MAX_UNATTACHED) {
      throw new UploadError("QUOTA", "This form can't take more uploads right now. Try again later.");
    }

    const [{ used } = { used: 0 }] = await db
      .select({ used: sql<number>`coalesce(sum(${fileUploadsTable.bytes}), 0)::bigint` })
      .from(fileUploadsTable)
      .where(
        and(
          form.createdBy
            ? eq(fileUploadsTable.ownerId, form.createdBy)
            : isNull(fileUploadsTable.ownerId),
          inArray(fileUploadsTable.status, ["CONFIRMED", "ATTACHED"]),
        ),
      );
    if (Number(used) + input.size > env.UPLOAD_OWNER_STORAGE_MB * MB) {
      throw new UploadError("QUOTA", "This form's upload storage is full. Please contact the form owner.");
    }

    // Random key: never derived from anything the visitor typed.
    const storageKey = `dockett/uploads/${randomUUID()}.${kind}`;

    const inserted = await db
      .insert(fileUploadsTable)
      .values({
        formId: form.id,
        fieldId: field.id,
        ownerId: form.createdBy,
        actorKey,
        storageKey,
        kind,
        mimeType: FILE_KINDS[kind].mime,
        displayName: sanitizeDisplayName(input.fileName),
      })
      .returning({ id: fileUploadsTable.id });
    const row = inserted[0];
    if (!row) throw new Error("Couldn't start the upload.");

    const signed = this.store.signUpload(storageKey);
    return {
      uploadId: row.id,
      uploadUrl: signed.url,
      fields: signed.fields,
      maxBytes: rules.maxBytes,
    };
  }

  // The browser says it finished: inspect the stored object before trusting it.
  public async confirmUpload(payload: ConfirmUploadInputType) {
    const input = await confirmUploadInput.parseAsync(payload);
    enforceRate(confirmLimiter, actorKeyFor(input.requesterId, input.ip));

    const row = await this.getRow(input.uploadId);
    if (!row) throw new UploadError("NOT_FOUND", "That upload doesn't exist any more.");
    if (row.status === "CONFIRMED" || row.status === "ATTACHED") return this.toConfirmed(row);

    const field =
      row.fieldId && row.formId
        ? await (async () => {
            const f = (
              await db
                .select({ publishedVersionId: formsTable.publishedVersionId })
                .from(formsTable)
                .where(eq(formsTable.id, row.formId!))
            )[0];
            return f ? this.resolveFileField(row.formId!, f.publishedVersionId, row.fieldId!) : null;
          })()
        : null;
    if (!field) {
      await this.destroy(row.id, row.storageKey);
      throw new UploadError("NOT_FOUND", "That upload field no longer exists.");
    }
    const rules = fileFieldRules(field.config);

    const info = await this.store.head(row.storageKey);
    if (!info) {
      // Not there (yet). Leave it PENDING; cleanup removes it if it never shows up.
      throw new UploadError("INVALID", "We couldn't find your upload. Please try again.");
    }

    if (info.bytes <= 0 || info.bytes > rules.maxBytes) {
      await this.destroy(row.id, row.storageKey);
      throw new UploadError("INVALID", `That file is too large. The limit is ${formatMb(rules.maxBytes)}.`);
    }

    const head = await this.store.readHead(row.storageKey, HEAD_BYTES);
    const actual = head ? sniffKind(head) : null;
    if (!head || actual !== row.kind || !rules.accept.includes(row.kind as FileKind)) {
      await this.destroy(row.id, row.storageKey);
      throw new UploadError(
        "INVALID",
        `That file doesn't look like a real ${FILE_KINDS[row.kind as FileKind]?.label ?? "document"}.`,
      );
    }

    const updated = await db
      .update(fileUploadsTable)
      .set({ status: "CONFIRMED", bytes: info.bytes, confirmedAt: new Date() })
      .where(and(eq(fileUploadsTable.id, row.id), eq(fileUploadsTable.status, "PENDING")))
      .returning();

    return this.toConfirmed(updated[0] ?? { ...row, bytes: info.bytes });
  }

  // A respondent removed a file before submitting. The (unguessable) id is the capability.
  public async discardUpload(payload: DiscardUploadInputType) {
    const input = await discardUploadInput.parseAsync(payload);
    enforceRate(confirmLimiter, actorKeyFor(input.requesterId, input.ip));
    const row = await this.getRow(input.uploadId);
    if (!row || row.status === "ATTACHED") return { ok: true };
    await this.destroy(row.id, row.storageKey);
    return { ok: true };
  }

  // Owner-only: a 5-minute signed link that downloads the file under its original name.
  public async getDownloadUrl(payload: DownloadUrlInputType) {
    const { uploadId, userId } = await downloadUrlInput.parseAsync(payload);
    const row = await this.getRow(uploadId);
    if (!row || !row.formId || row.status === "PENDING") {
      throw new UploadError("NOT_FOUND", "File not found.");
    }
    try {
      await assertFormOwnership(row.formId, userId);
    } catch {
      throw new UploadError("NOT_FOUND", "File not found.");
    }
    if (!this.store.isConfigured()) {
      throw new UploadError("NOT_CONFIGURED", "File storage isn't configured.");
    }
    const ttlSec = 300;
    return {
      url: this.store.downloadUrl(row.storageKey, { filename: row.displayName, ttlSec }),
      filename: row.displayName,
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
  }

  public async testStorage(userId: string) {
    const r = testLimiter.hit(`test:${userId}`);
    if (!r.ok) {
      throw new UploadError("RATE_LIMITED", `Please wait ${r.retryAfterSec}s before testing again.`);
    }
    const current = env.CLOUDINARY_DELIVERY_TYPE;
    if (!this.store.isConfigured()) {
      return { configured: false, current, recommended: null as string | null, results: [] };
    }
    const results = [await this.store.probe(current), await this.store.probe(current === "authenticated" ? "private" : "authenticated")];
    const working = results.find((x) => x.ok)?.type ?? null;
    return { configured: true, current, recommended: working as string | null, results };
  }

  public async cleanup(now = new Date()) {
    if (!this.store.isConfigured()) return { deleted: 0, failed: 0 };

    const ago = (ms: number) => new Date(now.getTime() - ms);
    const rows = await db
      .select({ id: fileUploadsTable.id, storageKey: fileUploadsTable.storageKey })
      .from(fileUploadsTable)
      .where(
        or(
          // signed but never finished (signatures expire after 1h)
          and(eq(fileUploadsTable.status, "PENDING"), lt(fileUploadsTable.createdAt, ago(90 * MIN))),
          // uploaded and verified but never submitted
          and(eq(fileUploadsTable.status, "CONFIRMED"), lt(fileUploadsTable.createdAt, ago(24 * 60 * MIN))),
          // its form / field was deleted before the submission happened
          and(
            eq(fileUploadsTable.status, "CONFIRMED"),
            isNull(fileUploadsTable.formId),
            lt(fileUploadsTable.createdAt, ago(5 * MIN)),
          ),
          // attached, but the form / field / submission was deleted afterwards
          and(
            eq(fileUploadsTable.status, "ATTACHED"),
            // A field removed from the draft later must NOT delete files already submitted to
            // an earlier version - only a deleted form / submission orphans them.
            or(isNull(fileUploadsTable.submissionId), isNull(fileUploadsTable.formId)),
            lt(fileUploadsTable.attachedAt, ago(10 * MIN)),
          ),
        ),
      )
      .limit(100);

    let deleted = 0;
    let failed = 0;
    for (const r of rows) {
      try {
        if (await this.store.remove(r.storageKey)) {
          await db.delete(fileUploadsTable).where(eq(fileUploadsTable.id, r.id));
          deleted++;
        } else failed++;
      } catch (err) {
        failed++;
        logger.error(`upload cleanup failed for ${r.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (deleted || failed) logger.info(`upload cleanup: ${deleted} removed, ${failed} failed`);
    return { deleted, failed };
  }

  public startCleanup(): () => void {
    if (!this.store.isConfigured()) {
      logger.info("upload cleanup not started: file storage isn't configured");
      return () => undefined;
    }
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      this.cleanup()
        .catch((err) =>
          logger.error(`upload cleanup crashed: ${err instanceof Error ? err.message : err}`),
        )
        .finally(() => {
          running = false;
        });
    };
    const interval = setInterval(run, env.UPLOAD_CLEANUP_INTERVAL_MIN * MIN);
    const first = setTimeout(run, 30_000);
    interval.unref();
    first.unref();
    return () => {
      clearInterval(interval);
      clearTimeout(first);
    };
  }

  // The field as a respondent sees it: from the published version, else (unpublished draft) the live field.
  private async resolveFileField(formId: string, publishedVersionId: string | null, fieldId: string) {
    if (publishedVersionId) {
      const v = (
        await db
          .select({ snapshot: formVersionsTable.snapshot })
          .from(formVersionsTable)
          .where(eq(formVersionsTable.id, publishedVersionId))
      )[0];
      const f = v?.snapshot.fields.find((x) => x.id === fieldId);
      return f ? { id: f.id, type: f.type, config: f.config } : null;
    }
    const live = (
      await db
        .select({ id: formFieldsTable.id, type: formFieldsTable.type, config: formFieldsTable.config })
        .from(formFieldsTable)
        .where(and(eq(formFieldsTable.id, fieldId), eq(formFieldsTable.formId, formId)))
    )[0];
    return live ?? null;
  }

  private async getRow(id: string) {
    return (await db.select().from(fileUploadsTable).where(eq(fileUploadsTable.id, id)))[0];
  }

  private async destroy(id: string, key: string) {
    try {
      if (await this.store.remove(key)) {
        await db.delete(fileUploadsTable).where(eq(fileUploadsTable.id, id));
      }
    } catch (err) {
      // Row stays; the cleanup job retries (it also matches stuck PENDING rows by age).
      logger.error(`couldn't delete stored object for ${id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private toConfirmed(row: { id: string; displayName: string; bytes: number | null; kind: string }) {
    return { uploadId: row.id, name: row.displayName, size: row.bytes ?? 0, kind: row.kind };
  }
}
// Used by form-submission                                                    
const MAX_FILES_HARD = 5;

export async function prepareSubmissionFiles(
  formId: string,
  field: { id: string; label: string; config: unknown },
  rawValue: string,
): Promise<{ ids: string[]; refs: StoredFileRef[] }> {
  const trimmed = rawValue.trim();
  if (trimmed === "" || trimmed === "[]") return { ids: [], refs: [] };

  let ids: unknown;
  try {
    ids = JSON.parse(trimmed);
  } catch {
    throw new Error(`"${field.label}": invalid file answer`);
  }
  if (
    !Array.isArray(ids) ||
    ids.length > MAX_FILES_HARD ||
    !ids.every((v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error(`"${field.label}": invalid file answer`);
  }

  const rules = fileFieldRules(field.config);
  if (ids.length > rules.maxFiles) {
    throw new Error(`"${field.label}" accepts at most ${rules.maxFiles} file${rules.maxFiles === 1 ? "" : "s"}`);
  }

  const rows = await db
    .select()
    .from(fileUploadsTable)
    .where(
      and(
        inArray(fileUploadsTable.id, ids as string[]),
        eq(fileUploadsTable.formId, formId),
        eq(fileUploadsTable.fieldId, field.id),
        eq(fileUploadsTable.status, "CONFIRMED"),
      ),
    );
  if (rows.length !== ids.length) {
    throw new Error(`A file for "${field.label}" is no longer available. Please upload it again.`);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const refs = (ids as string[]).map((id): StoredFileRef => {
    const r = byId.get(id)!;
    return { id, name: r.displayName, size: r.bytes ?? 0, kind: r.kind as FileKind };
  });
  return { ids: ids as string[], refs };
}

// Marks the files as part of the submission. Returns false if any was claimed concurrently.
export async function attachSubmissionFiles(
  submissionId: string,
  formId: string,
  ids: string[],
): Promise<boolean> {
  if (ids.length === 0) return true;
  const updated = await db
    .update(fileUploadsTable)
    .set({ status: "ATTACHED", submissionId, attachedAt: new Date() })
    .where(
      and(
        inArray(fileUploadsTable.id, ids),
        eq(fileUploadsTable.formId, formId),
        eq(fileUploadsTable.status, "CONFIRMED"),
      ),
    )
    .returning({ id: fileUploadsTable.id });
  return updated.length === ids.length;
}
