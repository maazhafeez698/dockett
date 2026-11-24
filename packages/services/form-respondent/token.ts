import jwt from "jsonwebtoken";
import { env } from "../env";

const TTL_SECONDS = 24 * 60 * 60;
const secret = () => `${env.JWT_SECRET}:respondent`;

export function signRespondentToken(formId: string, email: string): string {
  return jwt.sign({ typ: "rv", f: formId, e: email }, secret(), { expiresIn: TTL_SECONDS });
}

export function verifyRespondentToken(token: string | undefined | null, formId: string): { email: string } | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret()) as { typ?: string; f?: string; e?: string };
    if (p.typ !== "rv" || p.f !== formId || !p.e) return null;
    return { email: p.e };
  } catch {
    return null;
  }
}
