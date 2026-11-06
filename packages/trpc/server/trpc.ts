import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";

import { createContext } from "./context";
import { userService } from "./services";
import { ACCESS_TOKEN_COOKIE } from "./utils/cookie";

const GENERIC_ERROR_MESSAGE =
  "We couldn't complete that request. Please try again. If the problem continues, contact support.";

const TECHNICAL_ERROR_PATTERN =
  /failed query:|\bparams:|sqlstate|postgres|drizzle|duplicate key|foreign key|(?:not-null|check) constraint|violates .* constraint|invalid input (?:syntax for type|value for enum)|relation .* does not exist|column .* does not exist|\b(?:type|reference|syntax|range)error:|cannot (?:read|set) properties|is not a function|\bat\s+.{1,120}\([^)]*\)|(?:[a-z]:\\|\/app\/|\/home\/)|econn(?:refused|reset)|eai_again|enotfound|etimedout|socket hang up|\bea?uth\b.*(?:invalid login|535|authentication failed)|\b(?:query|database|db)\s+(?:failed|error)|\b(?:internal|unexpected)\s+(?:server\s+)?error\b|(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|webhook[_ -]?secret)\s*[:=]/i;

export function isTechnicalErrorMessage(message: string | undefined): boolean {
  return Boolean(message && TECHNICAL_ERROR_PATTERN.test(message));
}

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<typeof createContext>()
  .create({
    // Lets the web app tell "you hit a plan limit" (offer an upgrade) apart from any other FORBIDDEN error.
    errorFormatter({ shape, error }) {
      const planLimit = (error.cause as { planLimit?: string } | undefined)?.planLimit ?? null;
      const message =
        error.code === "INTERNAL_SERVER_ERROR" || isTechnicalErrorMessage(shape.message)
          ? GENERIC_ERROR_MESSAGE
          : shape.message;

      return {
        ...shape,
        message,
        data: { ...shape.data, stack: undefined, planLimit },
      };
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
