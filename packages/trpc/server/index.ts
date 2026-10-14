import { router } from "./trpc";

import { healthRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";
import { formRouter } from "./routes/form/route";
import { formFieldRouter } from "./routes/form-field/route";
import { formSubmissionRouter } from "./routes/form-submission/route";
import { analyticsRouter } from "./routes/analytics/route";
import { aiRouter } from "./routes/ai/route";
import { billingRouter } from "./routes/billing/route";
import { fileUploadRouter } from "./routes/file-upload/route";
import { fileUploadService } from "./services";

export const serverRouter = router({
  health: healthRouter,
  auth: authRouter,
  form: formRouter,
  formField: formFieldRouter,
  formSubmission: formSubmissionRouter,
  analytics: analyticsRouter,
  ai: aiRouter,
  billing: billingRouter,
  fileUpload: fileUploadRouter,
});

export { createContext } from "./context";
export { aiStreamHandler } from "./routes/ai/stream-handler";
export { paddleWebhookHandler } from "./routes/billing/webhook-handler";
/** Starts the abandoned-upload cleanup timer; returns a stop function. */
export const startUploadCleanup = () => fileUploadService.startCleanup();
export type ServerRouter = typeof serverRouter;
