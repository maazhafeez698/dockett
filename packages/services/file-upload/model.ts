// packages/services/file-upload/model.ts

import { z } from "zod";

export const createUploadInput = z.object({
  formId: z.uuid().describe("UUID of the form being filled in"),
  fieldId: z.uuid().describe("UUID of the FILE_UPLOAD field"),
  fileName: z.string().min(1).max(255).describe("Original file name (display only)"),
  mimeType: z.string().max(100).default("").describe("MIME type reported by the browser"),
  size: z.number().int().positive().describe("Declared size in bytes"),
  accessCode: z.string().max(12).optional().describe("Access code, for ACCESS_CODE forms"),
  requesterId: z.uuid().optional().describe("Signed-in respondent, if any"),
  ip: z.string().max(64).optional().describe("Client IP, for rate limiting"),
});
export type CreateUploadInputType = z.infer<typeof createUploadInput>;

export const createUploadOutput = z.object({
  uploadId: z.string(),
  uploadUrl: z.string(),
  fields: z.record(z.string(), z.string()),
  fileName: z.string(),
  maxBytes: z.number(),
});

export const confirmUploadInput = z.object({
  uploadId: z.uuid(),
  requesterId: z.uuid().optional(),
  ip: z.string().max(64).optional(),
});
export type ConfirmUploadInputType = z.infer<typeof confirmUploadInput>;

export const confirmUploadOutput = z.object({
  uploadId: z.string(),
  name: z.string(),
  size: z.number(),
  kind: z.string(),
});

export const discardUploadInput = z.object({
  uploadId: z.uuid(),
  ip: z.string().max(64).optional(),
  requesterId: z.uuid().optional(),
});
export type DiscardUploadInputType = z.infer<typeof discardUploadInput>;

export const downloadUrlInput = z.object({
  uploadId: z.uuid(),
  userId: z.uuid(),
});
export type DownloadUrlInputType = z.infer<typeof downloadUrlInput>;
