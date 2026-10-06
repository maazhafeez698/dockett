/**
 * Integration tests for plan enforcement against a REAL Postgres (opt-in):
 *
 *   AI_INTEGRATION_TESTS=1 DATABASE_URL=postgres://… pnpm --filter @repo/api test:billing:integration
 *
 * Needs the billing tables (packages/database/billing-schema.sql or the generated migration).
 * Uses a throwaway user per test and deletes it afterwards (forms/submissions cascade).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const enabled = process.env.AI_INTEGRATION_TESTS === "1" && !!process.env.DATABASE_URL;

test("plan enforcement (integration)", { skip: !enabled && "set AI_INTEGRATION_TESTS=1 and DATABASE_URL to run" }, async (t) => {
  const { db, sql } = await import("@repo/database");
  const { applyPaddleEvent } = await import("../store");
  const { getUserPlan, invalidateEntitlements, withPublishLimit, withResponseQuota, isFormSuspended } = await import("../enforce");
  const { signCheckoutBinding } = await import("../signature");
  const { PlanLimitError } = await import("../errors");

  const SECRET = "int_test_secret";
  const cfg = { prices: { premiumMonthly: "pri_m", premiumYearly: undefined }, webhookSecret: SECRET, graceDays: 7 };
  const users: string[] = [];

  async function newUser() {
    const id = randomUUID();
    await db.execute(sql`INSERT INTO users (id, full_name, email) VALUES (${id}::uuid, 'Billing Test', ${`bill-${id}@example.test`})`);
    users.push(id);
    return id;
  }
  async function newForm(owner: string, status: "DRAFT" | "PUBLISHED" = "DRAFT", createdAt?: string) {
    const id = randomUUID();
    await db.execute(sql`INSERT INTO forms (id, title, created_by, status, created_at) VALUES (${id}::uuid, 'F', ${owner}::uuid, ${status}::form_status_enum, COALESCE(${createdAt ?? null}::timestamp, now()))`);
    return id;
  }
  const event = (id: string, type: string, userId: string, status: string, at: Date, sub = "sub_" + userId.slice(0, 8)) => ({
    event_id: id,
    event_type: type,
    occurred_at: at.toISOString(),
    data: {
      id: sub,
      status,
      customer_id: "ctm_1",
      custom_data: { userId, sig: signCheckoutBinding(userId, SECRET) },
      items: [{ price: { id: "pri_m" }, quantity: 1 }],
      current_billing_period: { starts_at: at.toISOString(), ends_at: new Date(at.getTime() + 30 * 86_400_000).toISOString() },
      billing_cycle: { interval: "month", frequency: 1 },
    },
  });

  t.after(async () => {
    for (const id of users) await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    await db.execute(sql`DELETE FROM billing_events WHERE event_id LIKE 'int-%'`);
  });

  await t.test("webhook upgrades to Premium; duplicate delivery is a no-op; cancel returns to Basic", async () => {
    const u = await newUser();
    assert.equal((await getUserPlan(u)).key, "basic");
    const t0 = new Date();
    const first = await applyPaddleEvent(event("int-" + u + "-1", "subscription.created", u, "active", t0), cfg);
    assert.equal(first.outcome, "APPLIED");
    invalidateEntitlements(u);
    assert.equal((await getUserPlan(u)).key, "premium");

    const dup = await applyPaddleEvent(event("int-" + u + "-1", "subscription.created", u, "active", t0), cfg);
    assert.equal(dup.outcome, "DUPLICATE");

    await applyPaddleEvent(event("int-" + u + "-2", "subscription.canceled", u, "canceled", new Date(t0.getTime() + 1000)), cfg);
    invalidateEntitlements(u);
    assert.equal((await getUserPlan(u)).key, "basic");
  });

  await t.test("Basic: the 6th concurrent publish is refused, exactly 5 succeed", async () => {
    const u = await newUser();
    const forms = await Promise.all(Array.from({ length: 8 }, () => newForm(u)));
    const results = await Promise.allSettled(
      forms.map((id) =>
        withPublishLimit(u, id, async (tx) => {
          await tx.execute(sql`UPDATE forms SET status = 'PUBLISHED' WHERE id = ${id}::uuid`);
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
    for (const r of results) if (r.status === "rejected") assert.ok(r.reason instanceof PlanLimitError);
  });

  await t.test("Basic: response quota is 100 per form per month, even under concurrency", async () => {
    const u = await newUser();
    const f = await newForm(u, "PUBLISHED");
    const attempts = await Promise.allSettled(
      Array.from({ length: 120 }, () =>
        withResponseQuota(f, u, async (tx) => {
          await tx.execute(sql`INSERT INTO form_submissions (form_id, "values") VALUES (${f}::uuid, '[]'::json)`);
        }),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 100);
  });

  await t.test("downgrade: only the OLDEST published forms (up to the limit) stay live", async () => {
    const u = await newUser();
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push(await newForm(u, "PUBLISHED", `2026-01-0${i + 1} 00:00:00`));
    const flags = await Promise.all(ids.map((id) => isFormSuspended(id, u)));
    assert.deepEqual(flags, [false, false, false, false, false, true, true]);
  });
});
