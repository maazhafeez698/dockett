import { CookieOptions } from "express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import {
  setCookie as setCookieUtil,
  getCookie as getCookieUtil,
  clearCookie as clearCookieUtil,
} from "./utils/cookie";

export interface TRPCCtxUser {
  id: string;
}

export interface TRPCContext {
  setCookie: (name: string, value: string, opts: CookieOptions) => void;
  getCookie: (name: string) => string | undefined;
  clearCookie: (name: string) => void;
  /** Raw User-Agent header, for the lightweight device classification used
   * by view tracking. Nothing else in the app should need more of `req`
   * than this, so we don't expose the whole request object on ctx. */
  userAgent: string | undefined;
  /** Client IP (honours `trust proxy`), used only for rate limiting. Never stored raw. */
  ip: string | undefined;

  user?: TRPCCtxUser;
}

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const ctx: TRPCContext = {
    setCookie: (name: string, value: string, opts: CookieOptions) => {
      return setCookieUtil(res, name, value, opts);
    },
    getCookie: (name: string) => {
      return getCookieUtil(req, name);
    },
    clearCookie: (name: string) => {
      return clearCookieUtil(res, name);
    },
    userAgent: req.headers["user-agent"],
    ip: req.ip,

    user: undefined,
  };

  return ctx;
}
export type Context = Awaited<ReturnType<typeof createContext>>;
