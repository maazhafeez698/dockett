import type { Request, Response, CookieOptions } from "express";

export function setCookie(res: Response, name: string, value: string, opts: CookieOptions) {
  res.cookie(name, value, opts);
}

export function getCookie(req: Request, name: string): string | undefined {
  return req.cookies?.[name];
}

export function clearCookie(res: Response, name: string) {
  res.clearCookie(name);
}

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const nodeEnv = process.env.NODE_ENV as string | undefined;
const isProd = nodeEnv === "prod" || nodeEnv === "production";

const baseCookieOpts: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict",
  path: "/",
};

export function accessTokenCookieOpts(): CookieOptions {
  return {
    ...baseCookieOpts,
    maxAge: 15 * 60 * 1000, // fallback; actual JWT expiry is enforced server-side by ACCESS_TOKEN_TTL
  };
}

export function refreshTokenCookieOpts(expiresAt: Date): CookieOptions {
  return {
    ...baseCookieOpts,
    expires: expiresAt,
  };
}