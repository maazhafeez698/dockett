import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, effectiveState, hashSnapshot } from "../publication";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-20T12:00:00Z");
const row = (o: Partial<{ status: string; closesAt: Date | null; lastActivityAt: Date | null; closedReason: string | null }>) => ({
  status: "PUBLISHED",
  closesAt: null,
  lastActivityAt: new Date(now.getTime() - DAY),
  closedReason: null,
  ...o,
});

test("a scheduled closure takes effect at the deadline, server-side", () => {
  assert.equal(effectiveState(row({ closesAt: new Date(now.getTime() + 60_000) }), now).status, "PUBLISHED");
  const closed = effectiveState(row({ closesAt: new Date(now.getTime() - 1) }), now);
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.closedReason, "SCHEDULED");
  assert.equal(closed.due, true);
});

test("a form idle for 30 days is closed by the system", () => {
  assert.equal(effectiveState(row({ lastActivityAt: new Date(now.getTime() - 29 * DAY) }), now).status, "PUBLISHED");
  const idle = effectiveState(row({ lastActivityAt: new Date(now.getTime() - 31 * DAY) }), now);
  assert.equal(idle.status, "CLOSED");
  assert.equal(idle.closedReason, "INACTIVE");
});

test("drafts and manually closed forms are reported as stored", () => {
  assert.equal(effectiveState(row({ status: "DRAFT" }), now).status, "DRAFT");
  const manual = effectiveState(row({ status: "CLOSED", closedReason: "MANUAL" }), now);
  assert.deepEqual([manual.status, manual.closedReason, manual.due], ["CLOSED", "MANUAL", false]);
});

const field = (id: string, label: string) => ({
  id,
  formId: "f",
  label,
  labelKey: id,
  description: null,
  placeholder: null,
  isRequired: false,
  config: null,
  index: id,
  type: "TEXT",
  createdAt: new Date(),
  updatedAt: new Date(),
});
const form = { title: "T", description: null, template: "CLASSIC", submissionLayout: "ONE_AT_A_TIME" };

test("the content hash ignores timestamps but notices real edits", () => {
  const a = hashSnapshot(buildSnapshot(form, [field("1", "Name")]));
  const b = hashSnapshot(buildSnapshot(form, [{ ...field("1", "Name"), updatedAt: new Date(Date.now() + 5000) }]));
  assert.equal(a, b);
  assert.notEqual(a, hashSnapshot(buildSnapshot(form, [field("1", "Full name")])));
  assert.notEqual(a, hashSnapshot(buildSnapshot({ ...form, title: "T2" }, [field("1", "Name")])));
});
