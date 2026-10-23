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
import { formRespondentRouter } from "./routes/form-respondent/route";
import { fileUploadService, formService } from "./services";

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
  formRespondent: formRespondentRouter,
});

export { createContext } from "./context";
export { aiStreamHandler } from "./routes/ai/stream-handler";
export { paddleWebhookHandler } from "./routes/billing/webhook-handler";
/** Starts the abandoned-upload cleanup timer; returns a stop function. */
export const startUploadCleanup = () => fileUploadService.startCleanup();
/** Starts the sweep that closes forms whose automatic closure is due (or that went idle); returns a stop function. */
export const startFormLifecycle = () => formService.startLifecycle();
export type ServerRouter = typeof serverRouter;
