import { z } from "zod";

const planKeyEnum = z.enum(["basic", "premium", "business"]);

const planModel = z.object({
  key: planKeyEnum,
  name: z.string(),
  tagline: z.string(),
  priceMonthlyUsd: z.number().nullable().describe("USD per month; null when not sold by card"),
  priceYearlyUsd: z.number().nullable().describe("USD per year; null when no yearly price is offered"),
  purchasable: z.boolean().describe("True when the plan can be bought with a card (Premium only)"),
  contactSales: z.boolean().describe("True when the plan is arranged with sales (Business)"),
  maxActiveForms: z.number().nullable().describe("Published forms allowed at once; null = unlimited"),
  maxResponsesPerFormPerMonth: z.number().nullable().describe("Responses per form per month; null = unlimited"),
  premiumTemplates: z.boolean().describe("Developer, Retro and Ticket templates included"),
  highlights: z.array(z.object({ text: z.string(), soon: z.boolean().optional() })),
});

export const getBillingOverviewInputModel = z.undefined();
export const getBillingOverviewOutputModel = z.object({
  plan: planModel.describe("The user's current plan"),
  plans: z.array(planModel).describe("All plans, in display order"),
  subscription: z
    .object({
      status: z.enum(["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED", "CANCELED"]),
      billingCycle: z.string().nullable(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
      graceUntil: z.string().nullable(),
      managedByPaddle: z.boolean().describe("True when the user can open the Paddle customer portal"),
    })
    .nullable(),
  usage: z.object({
    activeForms: z.number(),
    suspendedForms: z.number().describe("Published forms beyond the plan's limit (suspended until upgrade)"),
  }),
  checkout: z.object({
    available: z.boolean().describe("False until Paddle is fully configured"),
    environment: z.enum(["sandbox", "production"]),
    clientToken: z.string().nullable().describe("Paddle.js client-side token (public by design)"),
    premiumMonthlyPriceId: z.string().nullable(),
    premiumYearlyPriceId: z.string().nullable(),
    customer: z.object({ email: z.string() }),
    customData: z
      .object({ userId: z.string(), sig: z.string() })
      .nullable()
      .describe("Passed to Paddle at checkout; signed so the webhook can trust it"),
  }),
});

export const createPortalSessionInputModel = z.undefined();
export const createPortalSessionOutputModel = z.object({
  url: z.string().describe("Paddle customer portal URL"),
  cancelUrl: z.string().nullable(),
  updatePaymentUrl: z.string().nullable(),
});
