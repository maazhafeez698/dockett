// packages/trpc/server/routes/file-upload/route.ts
//
// Direct-to-storage uploads. The browser never sends file bytes to this API: it asks for a
// signature here, uploads straight to storage, then calls confirmUpload so the server can verify
// the stored object before it is allowed to be submitted.

import { TRPCError } from "@trpc/server";
import { UploadError } from "@repo/services/file-upload";

import { authenticatedProcedure, optionalAuthProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { fileUploadService } from "../../services";
import {
  confirmUploadInputModel,
  confirmUploadOutputModel,
  createUploadInputModel,
  createUploadOutputModel,
  discardUploadInputModel,
  discardUploadOutputModel,
  getDownloadUrlInputModel,
  getDownloadUrlOutputModel,
  testStorageInputModel,
  testStorageOutputModel,
} from "./model";

const TAGS = ["FileUpload"];
const getPath = generatePath("/file-upload");

function toTrpcError(error: unknown): TRPCError {
  if (error instanceof UploadError) {
    const code = (
      {
        NOT_CONFIGURED: "PRECONDITION_FAILED",
        RATE_LIMITED: "TOO_MANY_REQUESTS",
        QUOTA: "TOO_MANY_REQUESTS",
        NOT_FOUND: "NOT_FOUND",
        FORBIDDEN: "FORBIDDEN",
        INVALID: "BAD_REQUEST",
      } as const
    )[error.code];
    return new TRPCError({ code, message: error.message });
  }
  // Unknown failures: don't leak internals (storage errors can contain account details).
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Something went wrong with the upload." });
}

export const fileUploadRouter = router({
  createUpload: optionalAuthProcedure
    .meta({ openapi: { method: "POST", path: getPath("/createUpload"), tags: TAGS } })
    .input(createUploadInputModel)
    .output(createUploadOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await fileUploadService.createUpload({
          ...input,
          requesterId: ctx.user?.id,
          ip: ctx.ip,
        });
      } catch (error) {
        throw toTrpcError(error);
      }
    }),

  confirmUpload: optionalAuthProcedure
    .meta({ openapi: { method: "POST", path: getPath("/confirmUpload"), tags: TAGS } })
    .input(confirmUploadInputModel)
    .output(confirmUploadOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await fileUploadService.confirmUpload({
          uploadId: input.uploadId,
          requesterId: ctx.user?.id,
          ip: ctx.ip,
        });
      } catch (error) {
        throw toTrpcError(error);
      }
    }),

  discardUpload: optionalAuthProcedure
    .meta({ openapi: { method: "POST", path: getPath("/discardUpload"), tags: TAGS } })
    .input(discardUploadInputModel)
    .output(discardUploadOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await fileUploadService.discardUpload({
          uploadId: input.uploadId,
          requesterId: ctx.user?.id,
          ip: ctx.ip,
        });
      } catch (error) {
        throw toTrpcError(error);
      }
    }),

  testStorage: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/testStorage"), tags: TAGS, protect: true } })
    .input(testStorageInputModel)
    .output(testStorageOutputModel)
    .mutation(async ({ ctx }) => {
      try {
        return await fileUploadService.testStorage(ctx.user.id);
      } catch (error) {
        throw toTrpcError(error);
      }
    }),

  getDownloadUrl: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/getDownloadUrl"), tags: TAGS, protect: true },
    })
    .input(getDownloadUrlInputModel)
    .output(getDownloadUrlOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await fileUploadService.getDownloadUrl({ uploadId: input.uploadId, userId: ctx.user.id });
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
});

export default fileUploadRouter;
