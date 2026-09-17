import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";

import { createContext } from "./context";
import { userService } from "./services";
import { ACCESS_TOKEN_COOKIE } from "./utils/cookie";

export const tRPCContext = initTRPC.meta<OpenApiMeta>().context<typeof createContext>().create({});

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
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Your session has expired, please sign in again" });
  }
});
