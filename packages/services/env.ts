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
  // ---- File uploads (Cloudinary). Optional: when unset, the FILE_UPLOAD field still exists in the
  // builder, but uploading reports "not set up" instead of crashing the server. ----
  // ---- Publishing / auth lifecycle ----
  FORM_INACTIVITY_CLOSE_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("A published form with no activity for this many days is closed automatically"),
  FORM_CLOSE_SWEEP_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .default(60)
    .describe("How often the server sweeps for forms whose automatic closure is due"),
  EMAIL_VERIFY_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(10080)
    .default(60)
    .describe("How long a Dockett sign-up verification link stays valid"),
  RESPONDENT_LINK_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(15)
    .describe("How long a respondent's email magic link stays valid"),
  // ---- File uploads (Cloudinary). Optional: when unset, the FILE_UPLOAD field still exists in the
  // builder, but uploading reports "not set up" instead of crashing the server. ----
  CLOUDINARY_CLOUD_NAME: z
    .string()
    .min(1)
    .optional()
    .describe("Cloudinary cloud name (Console → Settings → API Keys / Product Environment)"),
  CLOUDINARY_API_KEY: z.string().min(1).optional().describe("Cloudinary API key"),
  CLOUDINARY_API_SECRET: z
    .string()
    .min(1)
    .optional()
    .describe("Cloudinary API secret — server only, never sent to the browser"),
  CLOUDINARY_SIGNATURE_ALGORITHM: z
    .enum(["sha1", "sha256"])
    .default("sha1")
    .describe("Must match the signature algorithm set on your Cloudinary account"),
  CLOUDINARY_DELIVERY_TYPE: z
    .enum(["authenticated", "private"])
    .default("authenticated")
    .describe("Cloudinary access-control type for uploads (both are private). Use the one the storage self-test reports as working"),
  UPLOAD_MAX_FILE_MB: z.coerce
    .number()
    .min(0.1)
    .max(10)
    .default(5)
    .describe("Hard per-file size limit in MB (Cloudinary free plan caps raw files at 10 MB)"),
  UPLOAD_SIGN_LIMIT_PER_10_MIN: z.coerce
    .number()
    .int()
    .min(1)
    .default(30)
    .describe("Max upload signatures per visitor (IP or user) per 10 minutes"),
  UPLOAD_MAX_PENDING_PER_ACTOR: z.coerce
    .number()
    .int()
    .min(1)
    .default(10)
    .describe("Max not-yet-confirmed uploads one visitor may hold at a time"),
  UPLOAD_FORM_MAX_UNATTACHED: z.coerce
    .number()
    .int()
    .min(1)
    .default(50)
    .describe("Max uploads waiting (not yet submitted) per form"),
  UPLOAD_OWNER_STORAGE_MB: z.coerce
    .number()
    .min(1)
    .default(500)
    .describe("Max stored upload volume per form owner, in MB"),
  UPLOAD_CLEANUP_INTERVAL_MIN: z.coerce
    .number()
    .min(1)
    .default(15)
    .describe("How often abandoned uploads are cleaned up, in minutes"),
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
