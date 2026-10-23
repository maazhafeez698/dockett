import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import { authenticatedProcedure, publicProcedure, router } from "../../trpc";

import {
  createUserWithEmailAndPasswordInputModel,
  createUserWithEmailAndPasswordOutputModel,
  signInUserWithEmailAndPasswordInputModel,
  signInUserWithEmailAndPasswordOutputModel,
  getLoggedInUserInfoInputModel,
  getLoggedInUserInfoOutputModel,
  refreshAccessTokenInputModel,
  refreshAccessTokenOutputModel,
  logoutInputModel,
  logoutOutputModel,
  forgotPasswordInputModel,
  forgotPasswordOutputModel,
  resetPasswordInputModel,
  resetPasswordOutputModel,
  setPasswordInputModel,
  setPasswordOutputModel,
  signInWithGoogleInputModel,
  signInWithGoogleOutputModel,
  verifyEmailInputModel,
  verifyEmailOutputModel,
  resendVerificationEmailInputModel,
  resendVerificationEmailOutputModel,
} from "./model";

import { userService } from "../../services";
import type { Context } from "../../context";
import {
  EmailNotVerifiedError,
  TooManyRequestsError,
  VerificationLinkError,
  type TokenPair,
} from "@repo/services/user";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOpts,
  refreshTokenCookieOpts,
} from "../../utils/cookie";

import { generatePath } from "../../utils/path-generator";

const getPath = generatePath("/authentication");
const TAGS = ["Authentication"];

/**
 * Zod's own `.message` is a JSON blob, which is useless in a UI. Flatten it
 * to the first human-readable issue instead.
 */
function toReadableMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function setAuthCookies(ctx: Context, tokens: TokenPair) {
  ctx.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, accessTokenCookieOpts());
  ctx.setCookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    refreshTokenCookieOpts(tokens.refreshTokenExpiresAt),
  );
}

function clearAuthCookies(ctx: Context) {
  ctx.clearCookie(ACCESS_TOKEN_COOKIE);
  ctx.clearCookie(REFRESH_TOKEN_COOKIE);
}

export const authRouter = router({
  createUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createUserWithEmailAndPassword"),
        tags: TAGS,
      },
    })
    .input(createUserWithEmailAndPasswordInputModel)
    .output(createUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { fullName, email, password } = input;

      try {
        const created = await userService.createUserWithEmailAndPassword({
          fullName,
          email,
          password,
        });
        // No session yet: the account only becomes usable once the emailed link is opened.
        return { id: created.id, emailSent: created.emailSent };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to create account"),
        });
      }
    }),

  singInUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/signInUserWithEmailAndPassword"),
        tags: TAGS,
      },
    })
    .input(signInUserWithEmailAndPasswordInputModel)
    .output(signInUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      try {
        const signedIn = await userService.singInUserWithEmailAndPassword({ email, password });
        setAuthCookies(ctx, signedIn.tokens);
        return { id: signedIn.id };
      } catch (error) {
        if (error instanceof EmailNotVerifiedError) {
          // FORBIDDEN (not UNAUTHORIZED) lets the UI offer "resend verification email".
          throw new TRPCError({ code: "FORBIDDEN", message: error.message });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: toReadableMessage(error, "Invalid email address or password"),
        });
      }
    }),

  verifyEmail: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/verifyEmail"), tags: TAGS } })
    .input(verifyEmailInputModel)
    .output(verifyEmailOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const verified = await userService.verifyEmailWithToken({ token: input.token });
        // Verified: sign the user straight in so they land in the dashboard.
        setAuthCookies(ctx, verified.tokens);
        return { status: "OK" as const, id: verified.id };
      } catch (error) {
        if (error instanceof VerificationLinkError) return { status: error.reason };
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't verify your email. Please try again.",
        });
      }
    }),

  resendVerificationEmail: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/resendVerificationEmail"), tags: TAGS } })
    .input(resendVerificationEmailInputModel)
    .output(resendVerificationEmailOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        // Same answer whether or not the address is registered / already verified.
        await userService.resendVerificationEmail({ email: input.email, ip: ctx.ip });
        return { success: true };
      } catch (error) {
        if (error instanceof TooManyRequestsError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        return { success: true };
      }
    }),

  signInWithGoogle: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/signInWithGoogle"),
        tags: TAGS,
      },
    })
    .input(signInWithGoogleInputModel)
    .output(signInWithGoogleOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        const signedIn = await userService.signInWithGoogle({ idToken: input.idToken });
        setAuthCookies(ctx, signedIn.tokens);
        return { id: signedIn.id };
      } catch (error) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: toReadableMessage(error, "Google sign-in failed"),
        });
      }
    }),

  refreshAccessToken: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/refreshAccessToken"),
        tags: TAGS,
      },
    })
    .input(refreshAccessTokenInputModel)
    .output(refreshAccessTokenOutputModel)
    .mutation(async ({ ctx }) => {
      const refreshToken = ctx.getCookie(REFRESH_TOKEN_COOKIE);

      if (!refreshToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No active session" });
      }

      try {
        const rotated = await userService.rotateRefreshToken(refreshToken);
        setAuthCookies(ctx, rotated.tokens);
        return { id: rotated.id };
      } catch (error) {
        clearAuthCookies(ctx);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: toReadableMessage(error, "Session expired, please sign in again"),
        });
      }
    }),

  logout: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/logout"),
        tags: TAGS,
      },
    })
    .input(logoutInputModel)
    .output(logoutOutputModel)
    .mutation(async ({ ctx }) => {
      const refreshToken = ctx.getCookie(REFRESH_TOKEN_COOKIE);
      if (refreshToken) {
        await userService.revokeRefreshToken(refreshToken);
      }

      clearAuthCookies(ctx);
      return { success: true };
    }),

  forgotPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/forgotPassword"),
        tags: TAGS,
      },
    })
    .input(forgotPasswordInputModel)
    .output(forgotPasswordOutputModel)
    .mutation(async ({ input }) => {
      await userService.requestPasswordReset({ email: input.email });

      // Always the same response, whether or not the email exists —
      // otherwise this endpoint leaks which emails are registered.
      return {
        success: true,
        message: "If an account exists for that email, a reset link has been sent.",
      };
    }),

  resetPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/resetPassword"),
        tags: TAGS,
      },
    })
    .input(resetPasswordInputModel)
    .output(resetPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        await userService.resetPasswordWithToken({
          token: input.token,
          newPassword: input.newPassword,
        });
        // The reset itself already revokes every refresh token for the
        // user, so clear whatever session cookies this browser is holding.
        clearAuthCookies(ctx);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to reset password"),
        });
      }
    }),

  setPassword: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/setPassword"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(setPasswordInputModel)
    .output(setPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      try {
        await userService.setPasswordForUser({
          userId: ctx.user.id,
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
        });
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: toReadableMessage(error, "Failed to update password"),
        });
      }
    }),

  getLoggedInUserInfo: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getLoggedInUserInfo"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getLoggedInUserInfoInputModel)
    .output(getLoggedInUserInfoOutputModel)
    .query(async ({ ctx }) => {
      const { fullName, email, id, hasPassword } = await userService.getUserInfoById(ctx.user.id);

      return {
        id,
        fullName,
        email,
        hasPassword,
      };
    }),
});
