import { z } from "zod";

export const createUserWithEmailAndPasswordInputModel = z.object({
  fullName: z.string().describe("Name of the user"),
  email: z.email().describe("Email of the user"),
  password: z.string().describe("Password of the user"),
});

export const createUserWithEmailAndPasswordOutputModel = z.object({
  id: z.string().describe("ID of the user"),
  emailSent: z
    .boolean()
    .describe("Whether a verification email went out (false: ask the user to use 'Resend')"),
});

export const verifyEmailInputModel = z.object({
  token: z.string().min(10).max(256).describe("Token from the verification email link"),
});
export const verifyEmailOutputModel = z.object({
  status: z.enum(["OK", "EXPIRED", "USED", "INVALID"]),
  id: z.string().optional().describe("ID of the verified user (status OK)"),
});

export const resendVerificationEmailInputModel = z.object({
  email: z.email().describe("Email address the account was registered with"),
});
export const resendVerificationEmailOutputModel = z.object({
  success: z.boolean(),
});

export const signInUserWithEmailAndPasswordInputModel = z.object({
  email: z.email().describe("Email of the user"),
  password: z.string().describe("Password of the user"),
});

export const signInUserWithEmailAndPasswordOutputModel = z.object({
  id: z.string().describe("ID of the user"),
});

export const getLoggedInUserInfoInputModel = z.undefined();
export const getLoggedInUserInfoOutputModel = z.object({
  id: z.string().describe("ID of the user"),
  fullName: z.string().describe("Name of the user"),
  email: z.email().describe("Email of the user"),
  hasPassword: z
    .boolean()
    .describe("Whether the account has a password set (false for Google-only accounts)"),
});

export const refreshAccessTokenInputModel = z.object({});
export const refreshAccessTokenOutputModel = z.object({
  id: z.string().describe("ID of the user"),
});

export const logoutInputModel = z.object({});
export const logoutOutputModel = z.object({
  success: z.boolean(),
});

export const forgotPasswordInputModel = z.object({
  email: z.email().describe("Email address to send the password reset link to"),
});
export const forgotPasswordOutputModel = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const resetPasswordInputModel = z.object({
  token: z.string().describe("Password reset token from the emailed link"),
  newPassword: z.string().describe("New password to set"),
});
export const resetPasswordOutputModel = z.object({
  success: z.boolean(),
});

export const setPasswordInputModel = z.object({
  currentPassword: z.string().optional().describe("Required if the account already has a password"),
  newPassword: z.string().describe("New password to set"),
});
export const setPasswordOutputModel = z.object({
  success: z.boolean(),
});

export const signInWithGoogleInputModel = z.object({
  idToken: z.string().describe("ID token returned by Google Identity Services on the client"),
});
export const signInWithGoogleOutputModel = z.object({
  id: z.string().describe("ID of the user"),
});
