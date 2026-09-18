import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formFieldService } from "../../services";

import {
  createFieldInputModel,
  createFieldOutputModel,
  getFieldsInputModel,
  getFieldsOutputModel,
  updateFieldInputModel,
  updateFieldOutputModel,
  deleteFieldInputModel,
  deleteFieldOutputModel,
  reorderFieldsInputModel,
  reorderFieldsOutputModel,
} from "./model";

const TAGS = ["FormField"];
const getPath = generatePath("/form-field");

function toReadableMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

export const formFieldRouter = router({
  createField: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/createField"), tags: TAGS, protect: true },
    })
    .input(createFieldInputModel)
    .output(createFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formFieldService.createField({ ...input, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to create field"),
        });
      }
    }),

  getFields: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/getFields"), tags: TAGS, protect: true },
    })
    .input(getFieldsInputModel)
    .output(getFieldsOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        const result = await formFieldService.getFields({ formId: input.formId, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: toReadableMessage(error, "You don't have access to this form"),
        });
      }
    }),

  updateField: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/updateField"), tags: TAGS, protect: true },
    })
    .input(updateFieldInputModel)
    .output(updateFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formFieldService.updateField({ ...input, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to update field"),
        });
      }
    }),

  deleteField: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/deleteField"), tags: TAGS, protect: true },
    })
    .input(deleteFieldInputModel)
    .output(deleteFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formFieldService.deleteField({ ...input, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to delete field"),
        });
      }
    }),

  reorderFields: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/reorderFields"), tags: TAGS, protect: true },
    })
    .input(reorderFieldsInputModel)
    .output(reorderFieldsOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formFieldService.reorderFields({ ...input, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to reorder fields"),
        });
      }
    }),
});
