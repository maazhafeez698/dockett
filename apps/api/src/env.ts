import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.enum(["development", "prod", "production"]).default("development"),
  BASE_URL: z.string().default("http://localhost:8000"),
  WEB_URL: z.string().default("http://localhost:3000"),
  // Number of reverse proxies in front of the API (0 = none). Needed so req.ip
  // is the real client IP for per-IP throttling; never set it higher than the truth.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
