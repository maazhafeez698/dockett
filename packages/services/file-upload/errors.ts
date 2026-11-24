
export type UploadErrorCode =
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID"
  | "QUOTA";

// Safe-to-show errors from the upload service (the message is written for end users). 
export class UploadError extends Error {
  constructor(
    public readonly code: UploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}
