import UserService from "@repo/services/user";
import FormService from "@repo/services/form";
import FormFieldService from "@repo/services/form-field";
import FormSubmissionService from "@repo/services/form-submission";
import FormAnalyticsService from "@repo/services/form-analytics";
import AiService from "@repo/services/ai";
import BillingService from "@repo/services/billing";

export const userService = new UserService();
export const formService = new FormService();
export const formFieldService = new FormFieldService();
export const formSubmissionService = new FormSubmissionService();
export const formAnalyticsService = new FormAnalyticsService();
export const aiService = new AiService();
export const billingService = new BillingService();
