import { db, eq, and, gt, gte, isNull, desc } from "@repo/database";
import { logger } from "@repo/logger";
import { usersTable } from "@repo/database/models/user";
import { refreshTokensTable } from "@repo/database/models/refresh-token";
import { passwordResetTokensTable } from "@repo/database/models/password-reset-token";
import { emailVerificationTokensTable } from "@repo/database/models/email-verification-token";
import { oauthAccountsTable } from "@repo/database/models/oauth-account";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import { env } from "../env";
import { generateOpaqueToken, hashToken } from "./token-utils";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { EmailNotVerifiedError, TooManyRequestsError, VerificationLinkError } from "./errors";
import { SlidingWindowLimiter } from "../file-upload/rate-limit";

import {
  createUserWithEmailAndPassword,
  type CreateUserWithEmailAndPasswordType,
  generateUserTokenPayload,
  type GenerateUserTokenPayloadType,
  singInUserWithEmailAndPassword,
  type SingInUserWithEmailAndPasswordType,
  forgotPassword,
  type ForgotPasswordType,
  resetPassword,
  type ResetPasswordType,
  setPassword,
  type SetPasswordType,
  signInWithGoogle,
  type SignInWithGoogleType,
  resendVerificationEmail,
  type ResendVerificationEmailType,
  verifyEmail,
  type VerifyEmailType,
} from "./model";

export { EmailNotVerifiedError, TooManyRequestsError, VerificationLinkError } from "./errors";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email address or password";
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const HOUR = 60 * 60 * 1000;
// Resend-verification protection. These in-memory windows apply to everyone equally (whether or not
// the address is registered), so they can't be used to probe accounts; the per-user cooldown in the
// database (below) additionally holds across API instances.
const resendIpLimiter = new SlidingWindowLimiter(10, HOUR);
const resendEmailLimiter = new SlidingWindowLimiter(5, HOUR);
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFICATION_EMAILS_PER_HOUR = 5;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export default class UserService {
  private async getUserByEmail(email: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (!result || result.length === 0) return null;

    return result[0];
  }

  private async getUserById(id: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.id, id));

    if (!result || result.length === 0) return null;

    return result[0];
  }

  private generateAccessToken(payload: GenerateUserTokenPayloadType) {
    const { id } = generateUserTokenPayload.parse(payload);

    return jwt.sign({ id }, env.JWT_SECRET, {
      expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
    });
  }

  private async issueTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = this.generateAccessToken({ id: userId });

    const refreshToken = generateOpaqueToken();
    const refreshTokenExpiresAt = new Date(
      Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(refreshTokensTable).values({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });

    return { accessToken, refreshToken, refreshTokenExpiresAt };
  }

  /**
   * Sends a fresh verification link (older unused links stop working). Throttled per user, in the
   * database: at most one email a minute and five an hour. Returns whether an email actually went out.
   */
  private async sendVerificationLink(userId: string, email: string): Promise<boolean> {
    const recent = await db
      .select({ createdAt: emailVerificationTokensTable.createdAt })
      .from(emailVerificationTokensTable)
      .where(
        and(
          eq(emailVerificationTokensTable.userId, userId),
          gte(emailVerificationTokensTable.createdAt, new Date(Date.now() - HOUR)),
        ),
      )
      .orderBy(desc(emailVerificationTokensTable.createdAt));
    if (recent.length >= MAX_VERIFICATION_EMAILS_PER_HOUR) return false;
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return false;

    // One live link at a time.
    await db
      .update(emailVerificationTokensTable)
      .set({ usedAt: new Date() })
      .where(and(eq(emailVerificationTokensTable.userId, userId), isNull(emailVerificationTokensTable.usedAt)));

    const rawToken = generateOpaqueToken();
    await db.insert(emailVerificationTokensTable).values({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + env.EMAIL_VERIFY_TTL_MINUTES * 60 * 1000),
    });

    try {
      await sendVerificationEmail(email, `${env.WEB_URL}/verify-email?token=${rawToken}`);
      return true;
    } catch (error) {
      logger.error("auth.verification_email_failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      return false;
    }
  }

  /**
   * Registers an account that CANNOT sign in until its email is verified: no session is issued here.
   * An unverified address that registers again simply replaces the earlier attempt (last registrant
   * wins), so nobody can squat on someone else's address.
   */
  public async createUserWithEmailAndPassword(payload: CreateUserWithEmailAndPasswordType) {
    const { fullName, email, password } = await createUserWithEmailAndPassword.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);

    if (existingUser?.emailVerified) throw new Error("User with this email already exists");

    const passwordHash = await bcrypt.hash(password, 10);

    let userId: string;
    if (existingUser) {
      await db.update(usersTable).set({ fullName, passwordHash }).where(eq(usersTable.id, existingUser.id));
      userId = existingUser.id;
    } else {
      const result = await db
        .insert(usersTable)
        .values({ fullName, email, passwordHash, emailVerified: false })
        .returning({ id: usersTable.id });
      if (!result || result.length === 0 || !result[0]?.id) throw new Error("Failed to create user");
      userId = result[0].id;
    }

    const emailSent = await this.sendVerificationLink(userId, email);
    return { id: userId, emailSent };
  }

  /** Always resolves the same way for known / unknown / already-verified addresses. */
  public async resendVerificationEmail(payload: ResendVerificationEmailType) {
    const { email, ip } = await resendVerificationEmail.parseAsync(payload);

    const ipCheck = resendIpLimiter.hit(ip ?? "unknown");
    const emailCheck = resendEmailLimiter.hit(email.toLowerCase());
    if (!ipCheck.ok || !emailCheck.ok) {
      throw new TooManyRequestsError(Math.max(ipCheck.retryAfterSec, emailCheck.retryAfterSec));
    }

    const user = await this.getUserByEmail(email);
    if (!user || user.emailVerified) return;
    await this.sendVerificationLink(user.id, user.email);
  }

  /**
   * Consumes a verification link: single-use, expiring, atomic. On success the account is verified
   * and a session is issued, so the user lands in the dashboard without signing in again.
   */
  public async verifyEmailWithToken(payload: VerifyEmailType) {
    const { token } = await verifyEmail.parseAsync(payload);
    const tokenHash = hashToken(token);

    // The single UPDATE ... WHERE is the lock: two tabs racing on the same link, only one wins.
    const claimed = await db
      .update(emailVerificationTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokensTable.tokenHash, tokenHash),
          isNull(emailVerificationTokensTable.usedAt),
          gt(emailVerificationTokensTable.expiresAt, new Date()),
        ),
      )
      .returning({ userId: emailVerificationTokensTable.userId });

    const userId = claimed[0]?.userId;
    if (!userId) {
      const rows = await db
        .select({ usedAt: emailVerificationTokensTable.usedAt })
        .from(emailVerificationTokensTable)
        .where(eq(emailVerificationTokensTable.tokenHash, tokenHash));
      const record = rows[0];
      throw new VerificationLinkError(!record ? "INVALID" : record.usedAt ? "USED" : "EXPIRED");
    }

    await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, userId));
    // Any other outstanding links are now moot.
    await db
      .update(emailVerificationTokensTable)
      .set({ usedAt: new Date() })
      .where(and(eq(emailVerificationTokensTable.userId, userId), isNull(emailVerificationTokensTable.usedAt)));

    const tokens = await this.issueTokenPair(userId);
    return { id: userId, tokens };
  }

  public async singInUserWithEmailAndPassword(payload: SingInUserWithEmailAndPasswordType) {
    const { email, password } = await singInUserWithEmailAndPassword.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);

    // Same generic error for "no such user" and "wrong password" to avoid
    // leaking which emails are registered (user enumeration).
    if (!existingUser || !existingUser.passwordHash) {
      throw new Error(INVALID_CREDENTIALS_MESSAGE);
    }

    const isValid = await bcrypt.compare(password, existingUser.passwordHash);
    if (!isValid) throw new Error(INVALID_CREDENTIALS_MESSAGE);

    // Only reachable with the right password, so it doesn't reveal anything to a stranger.
    if (!existingUser.emailVerified) throw new EmailNotVerifiedError();

    const tokens = await this.issueTokenPair(existingUser.id);

    return { id: existingUser.id, tokens };
  }

  public async getUserInfoById(id: string) {
    const user = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
        passwordHash: usersTable.passwordHash,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!user || user.length === 0) throw new Error("User with this ID does not exist");

    const { passwordHash, ...rest } = user[0]!;
    // Never send the hash itself to the client — just whether one exists,
    // which is what the UI needs to decide which password flow to show.
    return { ...rest, hasPassword: Boolean(passwordHash) };
  }

  public async verifyAndDecodeAccessToken(token: string) {
    try {
      const result = jwt.verify(token, env.JWT_SECRET) as GenerateUserTokenPayloadType;
      return result;
    } catch {
      throw new Error("Invalid or expired access token");
    }
  }

  /**
   * Verifies a presented refresh token against the DB, rotates it (revokes
   * the old one, issues a new pair), and returns the new pair + user id.
   * Reusing an already-revoked token revokes every refresh token the user
   * has, since that's a signal the token may have been stolen and replayed.
   */
  public async rotateRefreshToken(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    const rows = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash));

    const record = rows[0];

    if (!record) throw new Error("Invalid refresh token");

    if (record.revokedAt) {
      await this.revokeAllRefreshTokensForUser(record.userId);
      throw new Error("Invalid refresh token");
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new Error("Refresh token has expired, please sign in again");
    }

    // Defence in depth: an unverified account never holds a session.
    const owner = await this.getUserById(record.userId);
    if (!owner?.emailVerified) throw new Error("Invalid refresh token");

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.id, record.id));

    const tokens = await this.issueTokenPair(record.userId);

    return { id: record.userId, tokens };
  }

  public async revokeRefreshToken(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokensTable.tokenHash, tokenHash), isNull(refreshTokensTable.revokedAt)),
      );
  }

  public async revokeAllRefreshTokensForUser(userId: string) {
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt)));
  }

  /**
   * Always resolves without throwing, and never reveals whether the email
   * is registered — that's what makes "forgot password" safe from
   * enumeration. Errors sending the email are swallowed for the same reason.
   */
  public async requestPasswordReset(payload: ForgotPasswordType) {
    const { email } = await forgotPassword.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);
    if (!existingUser) return;

    // No password on the account (Google-only) — nothing to reset. Stay
    // silent here too, same as the "user doesn't exist" case above, so
    // this endpoint can't be used to probe which accounts use a password.
    if (!existingUser.passwordHash) return;

    try {
      const rawToken = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await db.insert(passwordResetTokensTable).values({
        userId: existingUser.id,
        tokenHash: hashToken(rawToken),
        expiresAt,
      });

      const resetUrl = `${env.WEB_URL}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(existingUser.email, resetUrl);
    } catch (error) {
      // Deliberately swallowed — see doc comment above.
      logger.error("auth.password_reset_email_failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
    }
  }

  public async resetPasswordWithToken(payload: ResetPasswordType) {
    const { token, newPassword } = await resetPassword.parseAsync(payload);

    const tokenHash = hashToken(token);

    const rows = await db
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.tokenHash, tokenHash));

    const record = rows[0];

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new Error("This password reset link is invalid or has expired");
    }

    // Closes a loophole: without this, a stale reset link for a
    // Google-only account (issued before this rule existed, or requested
    // some other way) could still silently grant that account a password.
    const user = await this.getUserById(record.userId);
    if (!user?.passwordHash) {
      throw new Error("This account doesn't use a password — sign in with Google instead");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Clicking the emailed reset link proves control of the mailbox, so it also verifies the address.
    await db
      .update(usersTable)
      .set({ passwordHash, emailVerified: true })
      .where(eq(usersTable.id, record.userId));

    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, record.id));

    // A password change invalidates every existing session.
    await this.revokeAllRefreshTokensForUser(record.userId);

    return { id: record.userId };
  }

  public async setPasswordForUser(payload: SetPasswordType) {
    const { userId, currentPassword, newPassword } = await setPassword.parseAsync(payload);

    const user = await this.getUserById(userId);
    if (!user) throw new Error("User with this ID does not exist");

    // Google-only accounts can't add a password in this flow — only an
    // account that already has one can change it. See the decisions log
    // for why this is deliberate, not an oversight.
    if (!user.passwordHash) {
      throw new Error("This account uses Google sign-in and doesn't support setting a password");
    }

    if (!currentPassword) throw new Error("Current password is required to set a new one");

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new Error("Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

    return { id: userId };
  }

  public async signInWithGoogle(payload: SignInWithGoogleType) {
    const { idToken } = await signInWithGoogle.parseAsync(payload);

    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    const googlePayload = ticket.getPayload();

    if (!googlePayload || !googlePayload.sub || !googlePayload.email) {
      throw new Error("Invalid Google token");
    }

    // Google must vouch for the address, otherwise we'd be linking accounts on an unproven claim.
    if (googlePayload.email_verified === false) {
      throw new Error("Your Google account's email address isn't verified");
    }

    const { sub: googleAccountId, email, name } = googlePayload;

    const existingLink = await db
      .select()
      .from(oauthAccountsTable)
      .where(
        and(
          eq(oauthAccountsTable.provider, "google"),
          eq(oauthAccountsTable.providerAccountId, googleAccountId),
        ),
      );

    if (existingLink[0]) {
      const tokens = await this.issueTokenPair(existingLink[0].userId);
      return { id: existingLink[0].userId, tokens };
    }

    // No link yet — either link this Google account to an existing
    // email/password user, or create a brand new account.
    const existingUser = await this.getUserByEmail(email);

    if (existingUser && !existingUser.emailVerified) {
      // Someone registered this address with a password but never proved they own it. Google just
      // proved the real owner does — so verify it AND drop that unproven password, otherwise whoever
      // registered it first could keep signing in to the real owner's account.
      await db
        .update(usersTable)
        .set({ emailVerified: true, passwordHash: null })
        .where(eq(usersTable.id, existingUser.id));
      await this.revokeAllRefreshTokensForUser(existingUser.id);
    }

    const userId =
      existingUser?.id ??
      (
        await db
          .insert(usersTable)
          .values({ fullName: name ?? email.split("@")[0]!, email, passwordHash: null, emailVerified: true })
          .returning({ id: usersTable.id })
      )[0]?.id;

    if (!userId) throw new Error("Failed to create user");

    await db.insert(oauthAccountsTable).values({
      userId,
      provider: "google",
      providerAccountId: googleAccountId,
    });

    const tokens = await this.issueTokenPair(userId);
    return { id: userId, tokens };
  }
}
