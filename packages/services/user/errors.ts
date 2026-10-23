// packages/services/user/errors.ts
//
// Typed auth errors so the API layer can answer precisely (and the UI can react) without
// string-matching messages.

/** Correct password, but the email address hasn't been verified yet. */
export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Please verify your email address first. Check your inbox for the link.");
    this.name = "EmailNotVerifiedError";
  }
}

/** A verification link that can't be used. `reason` lets the UI offer the right next step. */
export class VerificationLinkError extends Error {
  constructor(public readonly reason: "EXPIRED" | "USED" | "INVALID") {
    super(
      reason === "EXPIRED"
        ? "This verification link has expired."
        : reason === "USED"
          ? "This verification link was already used."
          : "This verification link is invalid.",
    );
    this.name = "VerificationLinkError";
  }
}

/** Throttled. Safe to show as-is. */
export class TooManyRequestsError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super(`Too many requests. Try again in ${retryAfterSec} seconds.`);
    this.name = "TooManyRequestsError";
  }
}
