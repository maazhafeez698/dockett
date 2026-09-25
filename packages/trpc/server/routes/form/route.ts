import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import { authenticatedProcedure, optionalAuthProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { formService, formAnalyticsService } from "../../services";

import {
  createFormInputModel,
  createFormOutputModel,
  createFormFromTemplateInputModel,
  createFormFromTemplateOutputModel,
  listFormsInputModel,
  listFormsOutputModel,
  getFormInputModel,
  getFormOutputModel,
  getFormAccessInfoInputModel,
  getFormAccessInfoOutputModel,
  updateFormInputModel,
  updateFormOutputModel,
  deleteFormInputModel,
  deleteFormOutputModel,
  regenerateAccessCodeInputModel,
  regenerateAccessCodeOutputModel,
} from "./model";

const TAGS = ["Form"];
const getPath = generatePath("/form");

function toReadableMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

/** Maps the service's gate signals to the right tRPC error code + a
 * message the client can key off of to render a gate screen instead of a
 * generic error toast. */
function toGatedError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "ACCESS_CODE_REQUIRED") {
    return new TRPCError({ code: "FORBIDDEN", message: "ACCESS_CODE_REQUIRED" });
  }
  if (message === "LOGIN_REQUIRED") {
    return new TRPCError({ code: "UNAUTHORIZED", message: "LOGIN_REQUIRED" });
  }
  if (message === "Form not found") {
    return new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
  }
  return new TRPCError({
    code: "BAD_REQUEST",
    message: toReadableMessage(error, "Failed to load form"),
  });
}

export const formRouter = router({
  createForm: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/createForm"), tags: TAGS, protect: true },
    })
    .input(createFormInputModel)
    .output(createFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { title, description, template, submissionLayout } = input;

      const { id } = await formService.createForm({
        title,
        description,
        template,
        submissionLayout,
        createdBy: ctx.user.id,
      });

      return { id };
    }),

  createFormFromTemplate: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createFormFromTemplate"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(createFormFromTemplateInputModel)
    .output(createFormFromTemplateOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await formService.createFormFromTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to create form from template"),
        });
      }
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

  getFormAccessInfo: optionalAuthProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/getFormAccessInfo"), tags: TAGS },
    })
    .input(getFormAccessInfoInputModel)
    .output(getFormAccessInfoOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        const info = await formService.getFormAccessInfo(input.formId);
        // Best-effort view tracking — never blocks or fails the actual
        // page load; see FormAnalyticsService.recordView.
        void formAnalyticsService.recordView({ formId: input.formId, userAgent: ctx.userAgent });
        return info;
      } catch (error) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
      }
    }),

  getFormWithFields: optionalAuthProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/getForm"), tags: TAGS },
    })
    .input(getFormInputModel)
    .output(getFormOutputModel)
    .query(async ({ input, ctx }) => {
      try {
        const form = await formService.getFormWithFields({
          formId: input.formId,
          accessCode: input.accessCode,
          requesterId: ctx.user?.id,
        });
        return form;
      } catch (error) {
        throw toGatedError(error);
      }
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

  regenerateAccessCode: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/regenerateAccessCode"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(regenerateAccessCodeInputModel)
    .output(regenerateAccessCodeOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        return await formService.regenerateAccessCode({
          formId: input.formId,
          userId: ctx.user.id,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to regenerate access code"),
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
