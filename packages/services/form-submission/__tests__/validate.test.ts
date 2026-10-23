import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAnswers } from "../validate";

const f = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  formId: "f",
  label: `Field ${id}`,
  labelKey: id,
  description: null,
  placeholder: null,
  isRequired: false,
  config: null,
  index: id,
  type,
  createdAt: null,
  updatedAt: null,
  ...extra,
});

test("unknown / duplicated field ids are rejected (version mismatch)", () => {
  const fields = [f("a", "TEXT")];
  assert.throws(() => validateAnswers(fields, [{ fieldId: "zzz", value: "x" }]), /doesn't match the form/);
  assert.throws(
    () =>
      validateAnswers(fields, [
        { fieldId: "a", value: "1" },
        { fieldId: "a", value: "2" },
      ]),
    /twice/,
  );
});

test("required fields are enforced and every field is returned", () => {
  const fields = [f("a", "TEXT", { isRequired: true }), f("b", "TEXT")];
  assert.throws(() => validateAnswers(fields, [{ fieldId: "b", value: "x" }]), /"Field a" is required/);
  const out = validateAnswers(fields, [{ fieldId: "a", value: "hi" }]);
  assert.equal(out.get("a"), "hi");
  assert.equal(out.get("b"), "");
});

test("typed answers are checked against the published field definition", () => {
  const fields = [
    f("n", "NUMBER", { config: { minValue: 1, maxValue: 10, step: 1 } }),
    f("e", "EMAIL"),
    f("d", "DATE"),
    f("y", "YES_NO"),
    f("r", "RATING", { config: { max: 5 } }),
    f("s", "DROPDOWN", { config: { options: ["A", "B"] } }),
    f("g", "RADIO_GROUP", { config: { options: ["X", "Y"] } }),
  ];
  const ok = [
    { fieldId: "n", value: "3" },
    { fieldId: "e", value: "a@b.co" },
    { fieldId: "d", value: "2026-02-28" },
    { fieldId: "y", value: "true" },
    { fieldId: "r", value: "5" },
    { fieldId: "s", value: "A" },
    { fieldId: "g", value: "Y" },
  ];
  assert.doesNotThrow(() => validateAnswers(fields, ok));
  const bad = (id: string, value: string) =>
    assert.throws(() => validateAnswers(fields, ok.map((o) => (o.fieldId === id ? { fieldId: id, value } : o))));
  bad("n", "11");
  bad("n", "2.5");
  bad("e", "nope");
  bad("d", "2026-02-31");
  bad("y", "maybe");
  bad("r", "6");
  bad("s", "C");
  bad("g", "Z");
});

test("multi-select answers must come from the options (commas inside options work)", () => {
  const fields = [f("m", "MULTI_SELECT", { config: { options: ["Red", "Blue, light", "Green"] } })];
  const run = (v: string) => validateAnswers(fields, [{ fieldId: "m", value: v }]);
  assert.doesNotThrow(() => run("Red,Green"));
  assert.doesNotThrow(() => run("Blue, light,Red"));
  assert.throws(() => run("Red,Red"), /listed options/);
  assert.throws(() => run("Purple"), /listed options/);
  assert.throws(() => run("Blue"), /listed options/);
});

test("oversized answers are refused", () => {
  assert.throws(() => validateAnswers([f("a", "LONG_TEXT")], [{ fieldId: "a", value: "x".repeat(20_001) }]), /too long/);
  assert.throws(
    () => validateAnswers([f("a", "LONG_TEXT", { config: { maxLength: 5 } })], [{ fieldId: "a", value: "123456" }]),
    /at most 5/,
  );
});
