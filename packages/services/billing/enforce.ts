import { and, db, eq, sql } from "@repo/database";
import { formsTable } from "@repo/database/models/form";

import { getBillingConfig } from "./config";
import { resolvePlanKey } from "./entitlements";
import { PlanLimitError } from "./errors";
import { PLANS, effectiveTemplate, isAtLimit, isPremiumTemplate, formatLimit, type PlanDefinition } from "./plans";
import { findSubscription } from "./store";

type DbOrTx = Pick<typeof db, "select" | "execute">;
interface CacheEntry {
  plan: PlanDefinition;
  expires: number;
}
const CACHE_MS = 10_000;
const cache = new Map<string, CacheEntry>();

export function invalidateEntitlements(userId: string): void {
  cache.delete(userId);
}

export async function getUserPlan(userId: string): Promise<PlanDefinition> {
  const hit = cache.get(userId);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.plan;

  const sub = await findSubscription(userId);
  const key = resolvePlanKey(sub, new Date(now));
  const plan = PLANS[key];
  if (cache.size > 5000) cache.clear(); // bounded memory
  cache.set(userId, { plan, expires: now + CACHE_MS });
  return plan;
}


export async function assertTemplateAllowed(userId: string, template: string | undefined): Promise<void> {
  if (!template || !isPremiumTemplate(template)) return;
  const plan = await getUserPlan(userId);
  if (!plan.features.premiumTemplates) {
    throw new PlanLimitError(
      "PREMIUM_TEMPLATE",
      "The Developer, Retro and Ticket templates are Pro features. Upgrade to Pro to use them.",
    );
  }
}

export async function templateForOwner<T extends string>(
  ownerId: string | null,
  template: T,
): Promise<T | "CLASSIC"> {
  if (!ownerId || !isPremiumTemplate(template)) return template;
  const plan = await getUserPlan(ownerId);
  return effectiveTemplate(plan.features, template);
}


export async function countPublishedForms(userId: string, exec: DbOrTx = db, excludeFormId?: string): Promise<number> {
  const rows = await exec
    .select({ n: sql<number>`count(*)::int` })
    .from(formsTable)
    .where(
      and(
        eq(formsTable.createdBy, userId),
        eq(formsTable.status, "PUBLISHED"),
        excludeFormId ? sql`${formsTable.id} <> ${excludeFormId}::uuid` : undefined,
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function withPublishLimit<T>(
  userId: string,
  formId: string,
  apply: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  const plan = await getUserPlan(userId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"forms:" + userId}))`);
    const limit = plan.limits.maxActiveForms;
    if (limit !== null) {
      const active = await countPublishedForms(userId, tx, formId);
      if (isAtLimit(active, limit)) {
        throw new PlanLimitError(
          "ACTIVE_FORMS_LIMIT",
          `You've reached the ${formatLimit(limit)} active forms included in the ${plan.name} plan. ` +
            (plan.key === "basic"
              ? "Upgrade to Pro to publish more, or close a form you no longer need."
              : "Close a form you no longer need, or contact sales for a higher limit."),
        );
      }
    }
    return apply(tx);
  });
}

export async function isFormSuspended(formId: string, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return false;
  const plan = await getUserPlan(ownerId);
  const limit = plan.limits.maxActiveForms;
  if (limit === null) return false;

  const res = (await db.execute(sql`
    SELECT count(*)::int AS ahead
      FROM forms f
      JOIN forms me ON me.id = ${formId}::uuid
     WHERE f.created_by = ${ownerId}::uuid
       AND f.status = 'PUBLISHED'
       AND (COALESCE(f.created_at, 'epoch'::timestamp), f.id) < (COALESCE(me.created_at, 'epoch'::timestamp), me.id)`)) as unknown as
    | { rows?: Array<{ ahead: number }> }
    | Array<{ ahead: number }>;
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return Number(rows[0]?.ahead ?? 0) >= limit;
}


export async function countResponsesThisMonth(formId: string, exec: DbOrTx = db): Promise<number> {
  const res = (await exec.execute(sql`
    SELECT count(*)::int AS n FROM form_submissions
     WHERE form_id = ${formId}::uuid AND created_at >= date_trunc('month', now())`)) as unknown as
    | { rows?: Array<{ n: number }> }
    | Array<{ n: number }>;
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return Number(rows[0]?.n ?? 0);
}

export async function isResponseLimitReached(formId: string, ownerId: string | null): Promise<boolean> {
  if (!ownerId) return false;
  const plan = await getUserPlan(ownerId);
  const limit = plan.limits.maxResponsesPerFormPerMonth;
  if (limit === null) return false;
  return isAtLimit(await countResponsesThisMonth(formId), limit);
}

export async function withResponseQuota<T>(
  formId: string,
  ownerId: string | null,
  insert: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  const plan = ownerId ? await getUserPlan(ownerId) : PLANS.basic;
  const limit = plan.limits.maxResponsesPerFormPerMonth;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"resp:" + formId}))`);
    if (limit !== null && isAtLimit(await countResponsesThisMonth(formId, tx), limit)) {
      throw new PlanLimitError(
        "RESPONSES_LIMIT",
        "This form has reached its response limit for this month and isn't accepting new responses right now.",
      );
    }
    return insert(tx);
  });
}

export function billingConfigured(): boolean {
  return getBillingConfig().configured;
}
