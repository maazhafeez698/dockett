// packages/services/form-respondent/token.ts
//
// The credential a respondent holds after proving their email for ONE form. A JWT signed with a
// key derived from JWT_SECRET (so it can never be mistaken for a Dockett account token), valid for
// 24 hours, bound to the form and the address.

import jwt from "jsonwebtoken";
import { env } from "../env";

const TTL_SECONDS = 24 * 60 * 60;
const secret = () => `${env.JWT_SECRET}:respondent`;

export function signRespondentToken(formId: string, email: string): string {
  return jwt.sign({ typ: "rv", f: formId, e: email }, secret(), { expiresIn: TTL_SECONDS });
}

/** The verified address, or null if the token is missing / forged / expired / for another form. */
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
