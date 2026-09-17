import { z } from "zod";

export const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password must be at most 72 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const createUserWithEmailAndPassword = z.object({
  fullName: z.string().min(1).describe("Full name of the user"),
  email: z.email().describe("Email address of the user"),
  password: strongPassword.describe("Password of the user"),
});

export type CreateUserWithEmailAndPasswordType = z.infer<typeof createUserWithEmailAndPassword>;

export const generateUserTokenPayload = z.object({
  id: z.string().describe("ID of the user"),
});

export type GenerateUserTokenPayloadType = z.infer<typeof generateUserTokenPayload>;

export const singInUserWithEmailAndPassword = z.object({
  email: z.email().describe("Email address of the user"),
  password: z.string().describe("Password of the user"),
});

export type SingInUserWithEmailAndPasswordType = z.infer<typeof singInUserWithEmailAndPassword>;

export const refreshAccessToken = z.object({
  refreshToken: z.string().describe("Opaque refresh token read from the refresh_token cookie"),
});

export type RefreshAccessTokenType = z.infer<typeof refreshAccessToken>;

export const forgotPassword = z.object({
  email: z.email().describe("Email address of the user requesting a password reset"),
});

export type ForgotPasswordType = z.infer<typeof forgotPassword>;

export const resetPassword = z.object({
  token: z.string().describe("Opaque password reset token from the reset email link"),
  newPassword: strongPassword.describe("New password to set"),
});

export type ResetPasswordType = z.infer<typeof resetPassword>;

export const setPassword = z.object({
  userId: z.string().describe("ID of the currently logged in user"),
  currentPassword: z.string().optional().describe("Required only if the user already has a password set"),
  newPassword: strongPassword.describe("New password to set"),
});

export type SetPasswordType = z.infer<typeof setPassword>;

export const signInWithGoogle = z.object({
  idToken: z.string().describe("ID token returned by Google Identity Services on the client"),
});

export type SignInWithGoogleType = z.infer<typeof signInWithGoogle>;
