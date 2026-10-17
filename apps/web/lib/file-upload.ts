// apps/web/lib/file-upload.ts
//
// Browser side of direct-to-storage uploads:
//   1. ask our API for a signature (it authorises the upload and picks a random storage key)
//   2. POST the file straight to storage with that signature (progress via XHR)
//   3. ask our API to confirm — the server inspects the stored object before it can be submitted
//
// File bytes never pass through our API. Secrets never reach the browser: the signature only
// covers one object key.

"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "~/trpc/client";
import type { HuFileLike } from "~/components/hoop-upload/engine";

export interface UploadedFile {
  uploadId: string;
  name: string;
  size: number;
  kind: string;
}

// name/size of confirmed uploads, so a field remounted on another step can show them again
const META = new Map<string, { name: string; size: number }>();
export const getUploadMeta = (id: string) => META.get(id);

/** Accepted kinds (server enforces the same list; this only drives the picker + early feedback). */
export const KIND_EXTENSIONS: Record<string, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  jpg: [".jpg", ".jpeg"],
  png: [".png"],
};
export const ALL_KINDS = ["pdf", "docx", "jpg", "png"] as const;
export const KIND_LABELS: Record<string, string> = { pdf: "PDF", docx: "DOCX", jpg: "JPEG", png: "PNG" };

/** Cloudinary answers errors as {"error":{"message":"..."}} — surface it instead of a bare status. */
function storageErrorMessage(xhr: XMLHttpRequest): string {
  let message = "";
  try {
    const parsed = JSON.parse(xhr.responseText) as { error?: { message?: string } };
    message = parsed.error?.message ?? "";
  } catch {
    message = xhr.responseText?.slice(0, 200) ?? "";
  }
  const base = `Storage rejected the upload (HTTP ${xhr.status})`;
  return message ? `${base}: ${message}` : base;
}

function postToStorage(
  url: string,
  fields: Record<string, string>,
  file: File,
  fileName: string,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file, fileName); // must be last; keeps Cloudinary's raw asset extension canonical

    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(storageErrorMessage(xhr)));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.ontimeout = () => reject(new Error("The upload timed out."));
    xhr.timeout = 10 * 60 * 1000;
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(form);
  });
}

interface UploaderContext {
  formId: string;
  fieldId: string;
  accessCode?: string;
}

/** Returns the `upload` / `discard` functions for one FILE_UPLOAD field. */
export function useFileFieldUploader(ctx: UploaderContext) {
  const create = trpc.fileUpload.createUpload.useMutation();
  const confirm = trpc.fileUpload.confirmUpload.useMutation();
  const discardMutation = trpc.fileUpload.discardUpload.useMutation();

  // keep the latest mutation fns / context without changing the callbacks' identity
  const latest = useRef({ ctx, create, confirm, discardMutation });
  latest.current = { ctx, create, confirm, discardMutation };

  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);

  const upload = useCallback(
    async (file: File | HuFileLike, onProgress: (p: number) => void): Promise<UploadedFile> => {
      const { ctx, create, confirm, discardMutation } = latest.current;
      const real = file as File;
      let uploadId: string | null = null;
      try {
        const sig = await create.mutateAsync({
          formId: ctx.formId,
          fieldId: ctx.fieldId,
          fileName: real.name,
          mimeType: real.type ?? "",
          size: real.size,
          accessCode: ctx.accessCode,
        });
        uploadId = sig.uploadId;

        await postToStorage(
          sig.uploadUrl,
          sig.fields,
          real,
          sig.fileName,
          (f) => onProgress(Math.min(0.9, f * 0.9)),
          controller.current?.signal ?? new AbortController().signal,
        );
        onProgress(0.92);

        const done = await confirm.mutateAsync({ uploadId });
        META.set(done.uploadId, { name: done.name, size: done.size });
        return done;
      } catch (err) {
        if (uploadId) discardMutation.mutate({ uploadId }); // best effort; cleanup job is the backstop
        const message = err instanceof Error ? err.message : "Upload failed.";
        toast.error(message);
        throw err;
      }
    },
    [],
  );

  const discard = useCallback((uploadId: string) => {
    META.delete(uploadId);
    latest.current.discardMutation.mutate({ uploadId });
  }, []);

  return { upload, discard };
}
