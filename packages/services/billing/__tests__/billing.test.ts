import { test } from "node:test";
import assert from "node:assert/strict";

import { PLANS, PLAN_ORDER, PREMIUM_TEMPLATES, allowedTemplatesFor, effectiveTemplate, getPlan, isAtLimit, isPremiumTemplate } from "../plans";
import { resolvePlanKey, type SubscriptionState } from "../entitlements";
import { loadBillingConfig } from "../config";
import { signCheckoutBinding, signPaddleBody, verifyCheckoutBinding, verifyPaddleSignature } from "../signature";
import { parseSubscriptionEvent, planForPrice, type PaddleEvent } from "../webhook-parse";
import { decideUpdate, type ExistingSubscription } from "../apply";

const SECRET = "pdl_ntfset_test_secret";
const USER = "11111111-1111-4111-8111-111111111111";
const USER2 = "22222222-2222-4222-8222-222222222222";
const PRICES = { premiumMonthly: "pri_month", premiumYearly: "pri_year" };
const cfg = { prices: PRICES, webhookSecret: SECRET };
const NOW = new Date("2026-10-10T12:00:00Z");


test("plans match the approved table exactly", () => {
  assert.deepEqual(PLAN_ORDER, ["basic", "premium", "business"]);
  const { basic, premium, business } = PLANS;
  assert.deepEqual([basic.priceMonthlyUsd, premium.priceMonthlyUsd, business.priceMonthlyUsd], [0, 5, null]);
  assert.equal(premium.priceYearlyUsd, 50);
  assert.deepEqual(basic.limits, { maxActiveForms: 5, maxResponsesPerFormPerMonth: 100 });
  assert.deepEqual(premium.limits, { maxActiveForms: 50, maxResponsesPerFormPerMonth: 1000 });
  assert.deepEqual(business.limits, { maxActiveForms: null, maxResponsesPerFormPerMonth: null });
  assert.equal(basic.features.premiumTemplates, false);
  assert.equal(premium.features.premiumTemplates, true);
  assert.equal(business.features.premiumTemplates, true);
});

test("only Premium can be bought online; Business is contact-sales", () => {
  assert.deepEqual(PLAN_ORDER.filter((k) => PLANS[k].purchasable), ["premium"]);
  assert.deepEqual(PLAN_ORDER.filter((k) => PLANS[k].contactSales), ["business"]);
});

test("AI plan keys line up with the AI engine's plan table", () => {
  assert.deepEqual([PLANS.basic.aiPlanKey, PLANS.premium.aiPlanKey, PLANS.business.aiPlanKey], ["free", "pro", "business"]);
});

test("premium templates are exactly Developer, Retro and Ticket", () => {
  assert.deepEqual([...PREMIUM_TEMPLATES], ["DEVELOPER", "RETRO", "TICKET"]);
  for (const t of ["CORPORATE", "SURVEY", "EDUCATION", "INVITATION", "LANDING", "CLASSIC"]) assert.equal(isPremiumTemplate(t), false, t);
});

test("effectiveTemplate: premium templates fall back to CLASSIC without the entitlement", () => {
  assert.equal(effectiveTemplate(PLANS.basic.features, "RETRO"), "CLASSIC");
  assert.equal(effectiveTemplate(PLANS.basic.features, "SURVEY"), "SURVEY");
  assert.equal(effectiveTemplate(PLANS.premium.features, "RETRO"), "RETRO");
  assert.ok(!allowedTemplatesFor(PLANS.basic.features, ["SURVEY", "DEVELOPER", "TICKET"]).includes("TICKET"));
  assert.deepEqual(allowedTemplatesFor(PLANS.premium.features, ["SURVEY", "DEVELOPER"]), ["SURVEY", "DEVELOPER"]);
});

test("isAtLimit: null is unlimited, otherwise count >= limit blocks", () => {
  assert.equal(isAtLimit(4, 5), false);
  assert.equal(isAtLimit(5, 5), true);
  assert.equal(isAtLimit(999_999, null), false);
  assert.equal(getPlan("nonsense").key, "basic");
});


const sub = (o: Partial<SubscriptionState> = {}): SubscriptionState => ({ planKey: "premium", status: "ACTIVE", source: "PADDLE", graceUntil: null, ...o });

test("entitlements: no subscription, canceled and paused all mean Basic", () => {
  assert.equal(resolvePlanKey(null, NOW), "basic");
  assert.equal(resolvePlanKey(sub({ status: "CANCELED" }), NOW), "basic");
  assert.equal(resolvePlanKey(sub({ status: "PAUSED" }), NOW), "basic");
});

test("entitlements: active and trialing get the subscribed plan", () => {
  assert.equal(resolvePlanKey(sub(), NOW), "premium");
  assert.equal(resolvePlanKey(sub({ status: "TRIALING" }), NOW), "premium");
  assert.equal(resolvePlanKey(sub({ planKey: "business", source: "MANUAL" }), NOW), "business");
});

test("entitlements: past_due keeps the plan only until the grace period ends", () => {
  const graceUntil = new Date(NOW.getTime() + 3 * 86_400_000);
  assert.equal(resolvePlanKey(sub({ status: "PAST_DUE", graceUntil }), NOW), "premium");
  assert.equal(resolvePlanKey(sub({ status: "PAST_DUE", graceUntil }), new Date(graceUntil.getTime() + 1)), "basic");
  assert.equal(resolvePlanKey(sub({ status: "PAST_DUE", graceUntil: null }), NOW), "basic");
});

test("entitlements: an unknown plan key fails safe to Basic", () => {
  assert.equal(resolvePlanKey(sub({ planKey: "platinum" }), NOW), "basic");
  assert.equal(resolvePlanKey(sub({ planKey: "basic" }), NOW), "basic");
});


test("config: billing is only 'configured' when everything required is set, and says what is missing", () => {
  const off = loadBillingConfig({});
  assert.equal(off.configured, false);
  assert.deepEqual(off.missing, ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "PADDLE_CLIENT_TOKEN", "PADDLE_PRICE_ID_PREMIUM_MONTHLY"]);
  const on = loadBillingConfig({ PADDLE_API_KEY: "k", PADDLE_WEBHOOK_SECRET: "s", PADDLE_CLIENT_TOKEN: "test_abc", PADDLE_PRICE_ID_PREMIUM_MONTHLY: "pri_1" });
  assert.equal(on.configured, true);
  assert.equal(on.environment, "sandbox");
  assert.equal(on.apiBaseUrl, "https://sandbox-api.paddle.com");
  assert.equal(on.graceDays, 7);
});

test("config: sandbox/production mix-ups are caught at startup; blank values count as unset", () => {
  assert.throws(() => loadBillingConfig({ PADDLE_ENV: "production", PADDLE_CLIENT_TOKEN: "test_abc" }), /sandbox token/);
  assert.throws(() => loadBillingConfig({ PADDLE_ENV: "sandbox", PADDLE_CLIENT_TOKEN: "live_abc" }), /not a sandbox token/);
  assert.equal(loadBillingConfig({ PADDLE_ENV: "production", PADDLE_API_KEY: "", PADDLE_CLIENT_TOKEN: "live_abc" }).apiBaseUrl, "https://api.paddle.com");
  assert.throws(() => loadBillingConfig({ PADDLE_ENV: "staging" }));
});


const BODY = JSON.stringify({ event_id: "evt_1", event_type: "subscription.updated", occurred_at: NOW.toISOString(), data: {} });

test("signature: a correctly signed body verifies", () => {
  const header = signPaddleBody(BODY, SECRET, Math.floor(NOW.getTime() / 1000));
  assert.deepEqual(verifyPaddleSignature(BODY, header, SECRET, { toleranceSec: 300, nowMs: NOW.getTime() }), { ok: true });
});

test("signature: tampered body, wrong secret, missing/malformed header, replayed timestamp are all rejected", () => {
  const ts = Math.floor(NOW.getTime() / 1000);
  const header = signPaddleBody(BODY, SECRET, ts);
  const v = (body: string, h: string | undefined, secret = SECRET, nowMs = NOW.getTime()) => verifyPaddleSignature(body, h, secret, { toleranceSec: 300, nowMs });
  assert.deepEqual(v(BODY + " ", header), { ok: false, reason: "mismatch" });
  assert.deepEqual(v(BODY, header, "other-secret"), { ok: false, reason: "mismatch" });
  assert.deepEqual(v(BODY, undefined), { ok: false, reason: "missing" });
  assert.deepEqual(v(BODY, "garbage"), { ok: false, reason: "malformed" });
  assert.deepEqual(v(BODY, `ts=${ts};h1=nothex`), { ok: false, reason: "mismatch" });
  assert.deepEqual(v(BODY, header, SECRET, NOW.getTime() + 10 * 60_000), { ok: false, reason: "stale" });
});

test("signature: during secret rotation any one of several h1 values may match", () => {
  const ts = Math.floor(NOW.getTime() / 1000);
  const good = signPaddleBody(BODY, SECRET, ts).split(";h1=")[1]!;
  const header = `ts=${ts};h1=${"0".repeat(64)};h1=${good}`;
  assert.equal(verifyPaddleSignature(BODY, header, SECRET, { toleranceSec: 300, nowMs: NOW.getTime() }).ok, true);
});

test("checkout binding: only a signature minted by the server for THAT user verifies", () => {
  const sig = signCheckoutBinding(USER, SECRET);
  assert.equal(verifyCheckoutBinding(USER, sig, SECRET), true);
  assert.equal(verifyCheckoutBinding(USER2, sig, SECRET), false, "can't reuse one user's signature for another account");
  assert.equal(verifyCheckoutBinding(USER, sig, "other"), false);
  assert.equal(verifyCheckoutBinding(USER, "short", SECRET), false);
  assert.equal(verifyCheckoutBinding(undefined, undefined, SECRET), false);
});


function subEvent(over: Record<string, any> = {}, type = "subscription.created", id = "evt_1", at = NOW): PaddleEvent {
  return {
    event_id: id,
    event_type: type,
    occurred_at: at.toISOString(),
    data: {
      id: "sub_1",
      status: "active",
      customer_id: "ctm_1",
      custom_data: { userId: USER, sig: signCheckoutBinding(USER, SECRET) },
      items: [{ price: { id: "pri_month" }, quantity: 1 }],
      current_billing_period: { starts_at: "2026-10-10T12:00:00Z", ends_at: "2026-11-10T12:00:00Z" },
      billing_cycle: { interval: "month", frequency: 1 },
      scheduled_change: null,
      canceled_at: null,
      ...over,
    },
  };
}

test("parse: maps price ids to plans and cycles; unknown prices map to nothing", () => {
  assert.deepEqual(planForPrice("pri_month", PRICES), { plan: "premium", cycle: "month" });
  assert.deepEqual(planForPrice("pri_year", PRICES), { plan: "premium", cycle: "year" });
  assert.equal(planForPrice("pri_other", PRICES), null);
  assert.equal(planForPrice(null, PRICES), null);
});

test("parse: a good created event becomes a verified snapshot", () => {
  const s = parseSubscriptionEvent(subEvent(), cfg)!;
  assert.equal(s.userId, USER);
  assert.equal(s.planKey, "premium");
  assert.equal(s.status, "ACTIVE");
  assert.equal(s.billingCycle, "month");
  assert.equal(s.cancelAtPeriodEnd, false);
  assert.equal(s.periodEnd!.toISOString(), "2026-11-10T12:00:00.000Z");
});

test("parse: a forged or missing binding yields no user (cannot attach a purchase to someone else)", () => {
  assert.equal(parseSubscriptionEvent(subEvent({ custom_data: { userId: USER2, sig: signCheckoutBinding(USER, SECRET) } }), cfg)!.userId, null);
  assert.equal(parseSubscriptionEvent(subEvent({ custom_data: {} }), cfg)!.userId, null);
  assert.equal(parseSubscriptionEvent(subEvent({ custom_data: null }), cfg)!.userId, null);
});

test("parse: scheduled cancellation, statuses and junk payloads", () => {
  assert.equal(parseSubscriptionEvent(subEvent({ scheduled_change: { action: "cancel", effective_at: "2026-11-10T12:00:00Z" } }), cfg)!.cancelAtPeriodEnd, true);
  assert.equal(parseSubscriptionEvent(subEvent({ status: "past_due" }), cfg)!.status, "PAST_DUE");
  assert.equal(parseSubscriptionEvent(subEvent({ status: "canceled" }), cfg)!.status, "CANCELED");
  assert.equal(parseSubscriptionEvent(subEvent({ status: "weird" }), cfg), null);
  assert.equal(parseSubscriptionEvent({ ...subEvent(), event_type: "transaction.completed" }, cfg), null);
  assert.equal(parseSubscriptionEvent({ ...subEvent(), data: {} as any }, cfg), null);
  assert.doesNotThrow(() => parseSubscriptionEvent(subEvent({ items: "nope", current_billing_period: 5 }), cfg));
});


const existing = (o: Partial<ExistingSubscription> = {}): ExistingSubscription => ({
  userId: USER, planKey: "premium", source: "PADDLE", paddleSubscriptionId: "sub_1", status: "ACTIVE", graceUntil: null, lastEventAt: new Date(NOW.getTime() - 1000), ...o,
});
const decide = (event: PaddleEvent, byUser: ExistingSubscription | null, bySub: ExistingSubscription | null = byUser) =>
  decideUpdate({ snapshot: parseSubscriptionEvent(event, cfg)!, occurredAt: new Date(event.occurred_at), existingByUser: byUser, existingBySubscriptionId: bySub, graceDays: 7, now: NOW });

test("decide: a first purchase writes Premium for the verified user", () => {
  const d = decide(subEvent(), null, null);
  assert.equal(d.action, "write");
  if (d.action === "write") {
    assert.equal(d.userId, USER);
    assert.equal(d.values.planKey, "premium");
    assert.equal(d.values.status, "ACTIVE");
    assert.equal(d.values.graceUntil, null);
  }
});

test("decide: an unattributable event and an unknown price grant nothing", () => {
  assert.deepEqual(decide(subEvent({ custom_data: {} }), null, null), { action: "ignore", reason: "unknown_user" });
  assert.deepEqual(decide(subEvent({ items: [{ price: { id: "pri_mystery" } }] }), null, null), { action: "ignore", reason: "unknown_plan" });
});

test("decide: later events find the user through the subscription id (no custom data needed)", () => {
  const d = decide(subEvent({ custom_data: {}, status: "canceled" }, "subscription.canceled", "evt_9", new Date(NOW.getTime() + 5000)), null, existing());
  assert.equal(d.action, "write");
  if (d.action === "write") assert.equal(d.values.status, "CANCELED");
});

test("decide: out-of-order (older) events are dropped", () => {
  const old = subEvent({ status: "canceled" }, "subscription.canceled", "evt_old", new Date(NOW.getTime() - 60_000));
  assert.deepEqual(decide(old, existing(), existing()), { action: "stale" });
});

test("decide: payment failure starts ONE grace window; retries don't extend it; recovery clears it", () => {
  const failed = subEvent({ status: "past_due" }, "subscription.past_due", "evt_f", new Date(NOW.getTime() + 1000));
  const first = decide(failed, existing(), existing());
  assert.equal(first.action, "write");
  const graceEnd = first.action === "write" ? first.values.graceUntil! : new Date(0);
  assert.equal(graceEnd.getTime(), NOW.getTime() + 7 * 86_400_000);

  const retry = subEvent({ status: "past_due" }, "subscription.updated", "evt_f2", new Date(NOW.getTime() + 2000));
  const second = decide(retry, existing({ status: "PAST_DUE", graceUntil: graceEnd }), existing({ status: "PAST_DUE", graceUntil: graceEnd }));
  assert.equal(second.action === "write" && second.values.graceUntil!.getTime(), graceEnd.getTime());

  const recovered = subEvent({ status: "active" }, "subscription.updated", "evt_r", new Date(NOW.getTime() + 3000));
  const third = decide(recovered, existing({ status: "PAST_DUE", graceUntil: graceEnd }), existing({ status: "PAST_DUE", graceUntil: graceEnd }));
  assert.equal(third.action === "write" && third.values.graceUntil, null);
});

test("decide: a Business (manual) row is never touched by Paddle events", () => {
  const manual = existing({ source: "MANUAL", planKey: "business", paddleSubscriptionId: null });
  assert.deepEqual(decide(subEvent(), manual, null), { action: "ignore", reason: "manual_override" });
});

test("decide: late events from an OLD subscription cannot revoke or overwrite the current one", () => {
  const current = existing({ paddleSubscriptionId: "sub_new" });
  const oldCancel = subEvent({ id: "sub_old", status: "canceled" }, "subscription.canceled", "evt_oc", new Date(NOW.getTime() + 5000));
  assert.deepEqual(decide(oldCancel, current, null), { action: "ignore", reason: "superseded" });
});

test("decide: a re-subscription after cancellation replaces the dead row", () => {
  const dead = existing({ status: "CANCELED", paddleSubscriptionId: "sub_old" });
  const d = decide(subEvent({ id: "sub_new" }, "subscription.created", "evt_n", new Date(NOW.getTime() + 5000)), dead, null);
  assert.equal(d.action, "write");
  if (d.action === "write") assert.equal(d.values.paddleSubscriptionId, "sub_new");
});

test("decide: one Paddle subscription can never be attached to two users", () => {
  const theirs = existing({ userId: USER2 });
  assert.deepEqual(decide(subEvent(), null, theirs), { action: "ignore", reason: "unknown_user" });
});
