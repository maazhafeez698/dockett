
import { z } from "zod";

export const requestLinkInputModel = z.object({
  formId: z.uuid(),
  email: z.email().max(255).describe("Address to send the magic link to"),
  nonce: z.string().min(8).max(64).describe("Random id of this fill attempt (lets a corrected address replace the earlier link)"),
  accessCode: z.string().max(12).optional(),
});
export const requestLinkOutputModel = z.object({
  sent: z.boolean(),
  expiresAt: z.string(),
});

export const verifyLinkInputModel = z.object({
  token: z.string().min(10).max(256),
});
export const verifyLinkOutputModel = z.object({
  status: z.enum(["OK", "EXPIRED", "USED", "INVALID"]),
  formId: z.string().optional(),
  email: z.string().optional(),
  token: z.string().optional().describe("Credential for this form (status OK)"),
  alreadyResponded: z.boolean().optional().describe("This address already responded and the form allows one response per email"),
});

export const checkSessionInputModel = z.object({
  formId: z.uuid(),
  token: z.string().max(2048).optional(),
});
export const checkSessionOutputModel = z.object({
  valid: z.boolean(),
  email: z.string().optional(),
  alreadyResponded: z.boolean().optional(),
});
