import { db, eq, sql } from "@repo/database";
import { billingEventsTable, subscriptionsTable } from "@repo/database/models/subscription";

import { decideUpdate, type ExistingSubscription } from "./apply";
import { parseSubscriptionEvent, SUBSCRIPTION_EVENTS, type PaddleEvent } from "./webhook-parse";
import type { BillingConfig } from "./config";

export type WebhookOutcome = "APPLIED" | "STALE" | "IGNORED" | "DUPLICATE";

function toExisting(r: typeof subscriptionsTable.$inferSelect | undefined): ExistingSubscription | null {
  if (!r) return null;
  return {
    userId: r.userId,
    planKey: r.planKey,
    source: r.source,
    paddleSubscriptionId: r.paddleSubscriptionId,
    status: r.status,
    graceUntil: r.graceUntil,
    lastEventAt: r.lastEventAt,
  };
}

/**
 * Applies one verified Paddle event. ONE transaction covers the idempotency
 * record and the subscription write, so a crash can never leave an event
 * "seen" but not applied (Paddle would then retry and we'd skip it forever).
 * Returns the affected user id so callers can drop their cached entitlements.
 */
export async function applyPaddleEvent(
  event: PaddleEvent,
  cfg: Pick<BillingConfig, "prices" | "webhookSecret" | "graceDays">,
  now: Date = new Date(),
): Promise<{ outcome: WebhookOutcome; userId: string | null }> {
  const occurredAt = new Date(event.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Webhook event has an invalid occurred_at");

  return db.transaction(async (tx) => {
    const claimed = await tx
      .insert(billingEventsTable)
      .values({ eventId: event.event_id, eventType: event.event_type, occurredAt })
      .onConflictDoNothing()
      .returning({ id: billingEventsTable.eventId });
    if (claimed.length === 0) return { outcome: "DUPLICATE" as const, userId: null };

    const finish = async (outcome: Exclude<WebhookOutcome, "DUPLICATE">, userId: string | null) => {
      if (outcome !== "APPLIED") {
        await tx.update(billingEventsTable).set({ outcome }).where(eq(billingEventsTable.eventId, event.event_id));
      }
      return { outcome, userId };
    };

    if (!SUBSCRIPTION_EVENTS.has(event.event_type)) return finish("IGNORED", null);
    const snapshot = parseSubscriptionEvent(event, cfg);
    if (!snapshot) return finish("IGNORED", null);

    // Serialise all events of one subscription so concurrent deliveries can't interleave.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"sub:" + snapshot.paddleSubscriptionId}))`);

    const bySub = (
      await tx.select().from(subscriptionsTable).where(eq(subscriptionsTable.paddleSubscriptionId, snapshot.paddleSubscriptionId))
    )[0];
    const userForLookup = snapshot.userId ?? bySub?.userId ?? null;
    const byUser = userForLookup
      ? (await tx.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userForLookup)))[0]
      : undefined;

    const decision = decideUpdate({
      snapshot,
      occurredAt,
      existingByUser: toExisting(byUser),
      existingBySubscriptionId: toExisting(bySub),
      graceDays: cfg.graceDays,
      now,
    });

    if (decision.action === "ignore") return finish("IGNORED", userForLookup);
    if (decision.action === "stale") return finish("STALE", userForLookup);

    await tx
      .insert(subscriptionsTable)
      .values({ userId: decision.userId, source: "PADDLE", ...decision.values })
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: { ...decision.values, source: "PADDLE", updatedAt: now },
      });
    return finish("APPLIED", decision.userId);
  });
}

export async function findSubscription(userId: string) {
  const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  return rows[0] ?? null;
}
