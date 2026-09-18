import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formService } from "../../services";

import {
  createFormInputModel,
  createFormOutputModel,
  listFormsInputModel,
  listFormsOutputModel,
  getFormInputModel,
  getFormOutputModel,
  updateFormInputModel,
  updateFormOutputModel,
  deleteFormInputModel,
  deleteFormOutputModel,
} from "./model";

const TAGS = ["Form"];
const getPath = generatePath("/form");

function toReadableMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

export const formRouter = router({
  createForm: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/createForm"), tags: TAGS, protect: true },
    })
    .input(createFormInputModel)
    .output(createFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { title, description } = input;

      const { id } = await formService.createForm({
        title,
        description,
        createdBy: ctx.user.id,
      });

      return { id };
    }),

  listForms: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/listForms"), tags: TAGS, protect: true },
    })
    .input(listFormsInputModel)
    .output(listFormsOutputModel)
    .query(async ({ ctx }) => {
      const forms = await formService.listFormsByUserId({
        userId: ctx.user.id,
      });

      return forms;
    }),

  getFormWithFields: publicProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/getForm"), tags: TAGS },
    })
    .input(getFormInputModel)
    .output(getFormOutputModel)
    .query(async ({ input }) => {
      const { formId } = input;
      const form = await formService.getFormWithFields(formId);
      return form;
    }),

  updateForm: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/updateForm"), tags: TAGS, protect: true },
    })
    .input(updateFormInputModel)
    .output(updateFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formService.updateForm({ ...input, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to update form"),
        });
      }
    }),

  deleteForm: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/deleteForm"), tags: TAGS, protect: true },
    })
    .input(deleteFormInputModel)
    .output(deleteFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formService.deleteForm({ ...input, userId: ctx.user.id });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to delete form"),
        });
      }
    }),
});
