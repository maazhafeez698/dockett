import { db, eq, and, isNull } from "@repo/database";
import { usersTable } from "@repo/database/models/user";
import { refreshTokensTable } from "@repo/database/models/refresh-token";
import { passwordResetTokensTable } from "@repo/database/models/password-reset-token";
import { oauthAccountsTable } from "@repo/database/models/oauth-account";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { logger } from "@repo/logger";

import { env } from "../env";
import { generateOpaqueToken, hashToken } from "./token-utils";
import { sendPasswordResetEmail } from "./email";

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
} from "./model";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email address or password";
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

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

  public async createUserWithEmailAndPassword(payload: CreateUserWithEmailAndPasswordType) {
    const { fullName, email, password } = await createUserWithEmailAndPassword.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);

    if (existingUser) throw new Error("User with this email already exists");

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db
      .insert(usersTable)
      .values({ fullName, email, passwordHash })
      .returning({ id: usersTable.id });

    if (!result || result.length === 0 || !result[0]?.id) throw new Error("Failed to create user");

    const tokens = await this.issueTokenPair(result[0].id);

    return { id: result[0].id, tokens };
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
      logger.error("password_reset.email_failed", {
        message: error instanceof Error ? error.message : "unknown",
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

    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, record.userId));

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

    const userId =
      existingUser?.id ??
      (
        await db
          .insert(usersTable)
          .values({ fullName: name ?? email.split("@")[0]!, email, passwordHash: null })
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
