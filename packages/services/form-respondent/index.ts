// packages/services/form-respondent/index.ts
//
// "Verified email" respondents. No Dockett account: the respondent asks for a magic link, opens
// it, and gets a short-lived credential for that one form (see token.ts). Links are single-use and
// expire; asking again invalidates the earlier pending links of the same fill attempt (so a typo'd
// address can be corrected).

import { z } from "zod";
import { and, db, eq, gt, gte, isNull } from "@repo/database";
import { logger } from "@repo/logger";
import { formRespondentChallengesTable } from "@repo/database/models/form-respondent-challenge";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formsTable } from "@repo/database/models/form";
import { formVersionsTable } from "@repo/database/models/form-version";
import { isFormSuspended } from "@repo/services/billing";

import { env } from "../env";
import { SlidingWindowLimiter } from "../file-upload/rate-limit";
import { TooManyRequestsError } from "../user/errors";
import { sendRespondentLinkEmail } from "../user/email";
import { generateOpaqueToken, hashToken } from "../user/token-utils";
import { effectiveState } from "../form/publication";
import { signRespondentToken, verifyRespondentToken } from "./token";

export { signRespondentToken, verifyRespondentToken } from "./token";

const MIN = 60 * 1000;
const ipLimiter = new SlidingWindowLimiter(12, 10 * MIN);
const emailLimiter = new SlidingWindowLimiter(3, 10 * MIN);
const MAX_LINKS_PER_EMAIL_PER_HOUR = 6;

const requestInput = z.object({
  formId: z.uuid(),
  email: z.email().max(255),
  nonce: z.string().min(8).max(64),
  accessCode: z.string().max(12).optional(),
  ip: z.string().max(64).optional(),
});
export type RequestLinkInput = z.infer<typeof requestInput>;

const normalize = (email: string) => email.trim().toLowerCase();

export default class FormRespondentService {
  /** Sends the magic link. The checks mirror what submitting requires, so nobody is mailed for a form they could not fill in. */
  public async requestLink(payload: RequestLinkInput) {
    const input = await requestInput.parseAsync(payload);
    const email = normalize(input.email);

    const ip = ipLimiter.hit(input.ip ?? "unknown");
    const perEmail = emailLimiter.hit(`${input.formId}:${email}`);
    if (!ip.ok || !perEmail.ok) {
      throw new TooManyRequestsError(Math.max(ip.retryAfterSec, perEmail.retryAfterSec));
    }

    const form = (
      await db
        .select({
          id: formsTable.id,
          title: formsTable.title,
          status: formsTable.status,
          submissionAccess: formsTable.submissionAccess,
          accessCode: formsTable.accessCode,
          respondentIdentity: formsTable.respondentIdentity,
          publishedVersionId: formsTable.publishedVersionId,
          closesAt: formsTable.closesAt,
          lastActivityAt: formsTable.lastActivityAt,
          closedReason: formsTable.closedReason,
          createdBy: formsTable.createdBy,
        })
        .from(formsTable)
        .where(eq(formsTable.id, input.formId))
    )[0];
    if (!form || effectiveState(form).status !== "PUBLISHED") throw new Error("This form isn't accepting responses.");
    if (form.respondentIdentity !== "VERIFIED_EMAIL") throw new Error("This form doesn't need email verification.");
    if (await isFormSuspended(form.id, form.createdBy)) throw new Error("This form is temporarily unavailable.");
    if (form.submissionAccess === "ACCESS_CODE") {
      if (!input.accessCode || input.accessCode.toUpperCase() !== (form.accessCode ?? "").toUpperCase()) {
        throw new Error("A valid access code is required.");
      }
    }

    // Cross-instance backstop for the in-memory limiter above.
    const recent = await db
      .select({ id: formRespondentChallengesTable.id })
      .from(formRespondentChallengesTable)
      .where(
        and(
          eq(formRespondentChallengesTable.formId, form.id),
          eq(formRespondentChallengesTable.email, email),
          gte(formRespondentChallengesTable.createdAt, new Date(Date.now() - 60 * MIN)),
        ),
      );
    if (recent.length >= MAX_LINKS_PER_EMAIL_PER_HOUR) throw new TooManyRequestsError(600);

    // A new request for the same fill attempt replaces the earlier pending link(s).
    await db
      .update(formRespondentChallengesTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(formRespondentChallengesTable.formId, form.id),
          eq(formRespondentChallengesTable.nonce, input.nonce),
          isNull(formRespondentChallengesTable.usedAt),
        ),
      );

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.RESPONDENT_LINK_TTL_MINUTES * MIN);
    await db.insert(formRespondentChallengesTable).values({
      formId: form.id,
      email,
      nonce: input.nonce,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    let title = form.title;
    if (form.publishedVersionId) {
      const v = (
        await db
          .select({ snapshot: formVersionsTable.snapshot })
          .from(formVersionsTable)
          .where(eq(formVersionsTable.id, form.publishedVersionId))
      )[0];
      if (v) title = v.snapshot.title;
    }

    try {
      await sendRespondentLinkEmail(email, `${env.WEB_URL}/form/${form.id}?rv=${rawToken}`, title);
    } catch (error) {
      const smtpError = error as NodeJS.ErrnoException & { responseCode?: number; command?: string };
      logger.error("form_respondent.email_failed", {
        code: smtpError.code,
        responseCode: smtpError.responseCode,
        command: smtpError.command,
        message: smtpError.message,
      });
      throw new Error("We couldn't send the email. Please check the address and try again.");
    }
    return { sent: true as const, expiresAt: expiresAt.toISOString() };
  }

  /** Consumes the link (single use, atomic) and returns the credential for that form. */
  public async verify(token: string) {
    const tokenHash = hashToken(token);
    const claimed = await db
      .update(formRespondentChallengesTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(formRespondentChallengesTable.tokenHash, tokenHash),
          isNull(formRespondentChallengesTable.usedAt),
          gt(formRespondentChallengesTable.expiresAt, new Date()),
        ),
      )
      .returning({ formId: formRespondentChallengesTable.formId, email: formRespondentChallengesTable.email });

    const row = claimed[0];
    if (!row) {
      const rec = (
        await db
          .select({ usedAt: formRespondentChallengesTable.usedAt, formId: formRespondentChallengesTable.formId })
          .from(formRespondentChallengesTable)
          .where(eq(formRespondentChallengesTable.tokenHash, tokenHash))
      )[0];
      return {
        status: (!rec ? "INVALID" : rec.usedAt ? "USED" : "EXPIRED") as "INVALID" | "USED" | "EXPIRED",
        formId: rec?.formId,
      };
    }

    return {
      status: "OK" as const,
      formId: row.formId,
      email: row.email,
      token: signRespondentToken(row.formId, row.email),
      alreadyResponded: await this.hasResponded(row.formId, row.email),
    };
  }

  /** Is this stored credential still good (not expired / forged)? */
  public async checkSession(formId: string, token: string | undefined) {
    const claims = verifyRespondentToken(token, formId);
    if (!claims) return { valid: false as const };
    return { valid: true as const, email: claims.email, alreadyResponded: await this.hasResponded(formId, claims.email) };
  }

  /** Only meaningful while the form enforces one response per email. */
  private async hasResponded(formId: string, email: string): Promise<boolean> {
    const form = (
      await db
        .select({ one: formsTable.oneResponsePerEmail })
        .from(formsTable)
        .where(eq(formsTable.id, formId))
    )[0];
    if (!form?.one) return false;
    const hit = await db
      .select({ id: formSubmissionsTable.id })
      .from(formSubmissionsTable)
      .where(and(eq(formSubmissionsTable.formId, formId), eq(formSubmissionsTable.emailKey, email)))
      .limit(1);
    return hit.length > 0;
  }
}
