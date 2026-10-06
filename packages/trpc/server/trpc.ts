import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";

import { createContext } from "./context";
import { userService } from "./services";
import { ACCESS_TOKEN_COOKIE } from "./utils/cookie";

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<typeof createContext>()
  .create({
    // Lets the web app tell "you hit a plan limit" (offer an upgrade) apart from any other FORBIDDEN error.
    errorFormatter({ shape, error }) {
      const planLimit = (error.cause as { planLimit?: string } | undefined)?.planLimit ?? null;
      return { ...shape, data: { ...shape.data, planLimit } };
    },
  });

export const router = tRPCContext.router;

export const publicProcedure = tRPCContext.procedure;

export const authenticatedProcedure = tRPCContext.procedure.use(async (options) => {
  const { ctx } = options;

  const accessToken = ctx.getCookie(ACCESS_TOKEN_COOKIE);
  if (!accessToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to do this" });
  }

  try {
    const { id } = await userService.verifyAndDecodeAccessToken(accessToken);

    return options.next({
      ctx: {
        ...ctx,
        user: { id },
      },
    });
  } catch {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your session has expired, please sign in again",
    });
  }
});

/**
 * Like publicProcedure, but populates ctx.user when a valid access token is
 * present — never throws. Used by respondent-facing endpoints (public form
 * fetch, submission) that need to know "is this visitor logged in, and are
 * they the owner?" without requiring login outright. A missing or expired
 * token is treated as "anonymous visitor", not an error.
 */
export const optionalAuthProcedure = tRPCContext.procedure.use(async (options) => {
  const { ctx } = options;

  const accessToken = ctx.getCookie(ACCESS_TOKEN_COOKIE);
  let user = ctx.user;

  if (accessToken) {
    try {
      const { id } = await userService.verifyAndDecodeAccessToken(accessToken);
      user = { id };
    } catch {
      user = undefined;
    }
  }

  return options.next({ ctx: { ...ctx, user } });
});
