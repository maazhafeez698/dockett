// packages/trpc/server/routes/file-upload/model.ts

import { z } from "zod";

export const createUploadInputModel = z.object({
  formId: z.uuid().describe("UUID of the form being filled in"),
  fieldId: z.uuid().describe("UUID of the file-upload field"),
  fileName: z.string().min(1).max(255).describe("Original file name"),
  mimeType: z.string().max(100).default("").describe("MIME type reported by the browser"),
  size: z.number().int().positive().describe("File size in bytes"),
  accessCode: z.string().max(12).optional().describe("Access code, if the form needs one"),
});

export const createUploadOutputModel = z.object({
  uploadId: z.string().describe("ID to confirm / submit after the upload finishes"),
  uploadUrl: z.string().describe("Storage URL to POST the file to"),
  fields: z.record(z.string(), z.string()).describe("Form fields to send with the file, as given"),
  fileName: z.string().describe("Generated filename with the canonical storage extension"),
  maxBytes: z.number().describe("Largest file the field accepts, in bytes"),
});

export const confirmUploadInputModel = z.object({
  uploadId: z.uuid(),
});

export const confirmUploadOutputModel = z.object({
  uploadId: z.string(),
  name: z.string(),
  size: z.number(),
  kind: z.string(),
});

export const discardUploadInputModel = z.object({
  uploadId: z.uuid(),
});

export const discardUploadOutputModel = z.object({ ok: z.boolean() });

export const testStorageInputModel = z.object({});

export const testStorageOutputModel = z.object({
  configured: z.boolean(),
  current: z.string().describe("The delivery type the server is configured to use"),
  recommended: z.string().nullable().describe("A delivery type that passed every step, if any"),
  results: z.array(
    z.object({
      type: z.string(),
      ok: z.boolean(),
      steps: z.array(z.object({ name: z.string(), ok: z.boolean(), detail: z.string() })),
    }),
  ),
});

export const getDownloadUrlInputModel = z.object({
  uploadId: z.uuid().describe("ID of the uploaded file"),
});

export const getDownloadUrlOutputModel = z.object({
  url: z.string(),
  filename: z.string(),
  expiresAt: z.string(),
});
