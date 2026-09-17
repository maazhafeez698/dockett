import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z
    .string()
    .min(32)
    .describe("JWT secret key used for signing and verifying JSON Web Tokens"),

  ACCESS_TOKEN_TTL: z
    .string()
    .default("15m")
    .describe("Lifetime of the short-lived access token, e.g. '15m'"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce
    .number()
    .default(30)
    .describe("Lifetime of the refresh token, in days"),
  RESET_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .default(60)
    .describe("Lifetime of a password reset token, in minutes"),

  WEB_URL: z
    .string()
    .default("http://localhost:3000")
    .describe("Base URL of the web app, used to build links in emails"),

  GOOGLE_CLIENT_ID: z
    .string()
    .describe("OAuth2 client ID from Google Cloud Console, used to verify Google ID tokens"),

  SMTP_HOST: z.string().default("smtp.gmail.com").describe("SMTP server host"),
  SMTP_PORT: z.coerce.number().default(587).describe("SMTP server port"),
  SMTP_USER: z.string().describe("SMTP username — for Gmail, your full email address"),
  SMTP_PASS: z
    .string()
    .describe("SMTP password — for Gmail, a 16-character App Password, not your normal password"),
  SMTP_FROM_EMAIL: z
    .string()
    .optional()
    .describe("Sender address shown to recipients; defaults to SMTP_USER if not set"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
