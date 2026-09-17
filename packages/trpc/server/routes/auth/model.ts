import { z } from "zod";

export const createUserWithEmailAndPasswordInputModel = z.object({
  fullName: z.string().describe("Name of the user"),
  email: z.email().describe("Email of the user"),
  password: z.string().describe("Password of the user"),
});

export const createUserWithEmailAndPasswordOutputModel = z.object({
  id: z.string().describe("ID of the user"),
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
