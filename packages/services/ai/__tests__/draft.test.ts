import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeModelOutput, parseModelJson, dedupeLabels, toLabelKey, formDraftSchema, clipReply, LIMITS } from "../draft";
import { baseField, goodJson } from "./helpers";

const opts = { maxFields: 30 };
const f = (o: Record<string, unknown>) => ({ ...baseField, label: "Q", type: "TEXT", ...o });

test("valid output normalises and satisfies the save schema", () => {
  const out = normalizeModelOutput(JSON.parse(goodJson()), opts);
  assert.ok(out.draft);
  assert.equal(out.draft.template, "SURVEY");
  assert.equal(out.draft.fields[1]!.config?.max, 5);
  assert.deepEqual(out.draft.fields[2]!.config?.options, ["Food", "Service", "Vibes"]);
  assert.ok(formDraftSchema.safeParse(out.draft).success);
});

test("PASSWORD and unknown field types are dropped, never persisted", () => {
  const out = normalizeModelOutput(JSON.parse(goodJson({ fields: [f({ label: "Pw", type: "PASSWORD" }), f({ label: "X", type: "HOLOGRAM" }), f({ label: "Ok" })] })), opts);
  assert.deepEqual(out.draft!.fields.map((x) => x.label), ["Ok"]);
  assert.equal(out.droppedFields, 2);
});

test("choice fields need >=2 distinct options; duplicates removed case-insensitively", () => {
  const out = normalizeModelOutput(JSON.parse(goodJson({ fields: [
    f({ label: "One", type: "DROPDOWN", options: ["only"] }),
    f({ label: "Dup", type: "CHECKBOX_GROUP", options: ["A", "a", "B", " "] }),
  ] })), opts);
  assert.deepEqual(out.draft!.fields.map((x) => x.label), ["Dup"]);
  assert.deepEqual(out.draft!.fields[0]!.config?.options, ["A", "B"]);
});

test("rating max is clamped to a sane scale; maxLength only for LONG_TEXT", () => {
  const out = normalizeModelOutput(JSON.parse(goodJson({ fields: [
    f({ label: "R1", type: "RATING", ratingMax: 99 }),
    f({ label: "R2", type: "RATING", ratingMax: 7 }),
    f({ label: "T", type: "TEXT", maxLength: 50, placeholder: "p" }),
    f({ label: "L", type: "LONG_TEXT", maxLength: 99999 }),
  ] })), opts);
  const [r1, r2, t, l] = out.draft!.fields;
  assert.equal(r1!.config?.max, 5);
  assert.equal(r2!.config?.max, 7);
  assert.equal(t!.config, undefined);
  assert.equal(l!.config?.maxLength, 5000);
});

test("lengths are clipped to DB column limits and markup characters stripped", () => {
  const out = normalizeModelOutput(JSON.parse(goodJson({ title: "T".repeat(200), fields: [f({ label: "<script>alert(1)</script> " + "x".repeat(300), description: "d".repeat(900) })] })), opts);
  assert.ok(out.draft!.title.length <= 50);
  assert.ok(out.draft!.fields[0]!.label.length <= 100);
  assert.ok(!/[<>]/.test(out.draft!.fields[0]!.label));
  assert.ok(out.draft!.fields[0]!.description!.length <= 300);
});

test("duplicate labels are made unique by label key", () => {
  const out = normalizeModelOutput(JSON.parse(goodJson({ fields: [f({ label: "Email" }), f({ label: "email" }), f({ label: "EMAIL!" })] })), opts);
  const keys = out.draft!.fields.map((x) => toLabelKey(x.label));
  assert.equal(new Set(keys).size, 3);
});

test("dedupeLabels respects keys that already exist on the form", () => {
  const out = dedupeLabels([{ label: "Name", type: "TEXT", isRequired: false }], ["name"]);
  assert.equal(out[0]!.label, "Name 2");
});

test("unknown template/layout fall back to safe defaults; field count capped", () => {
  const many = Array.from({ length: 50 }, (_, i) => f({ label: `Q${i}` }));
  const raw = JSON.parse(goodJson({ fields: many }));
  raw.form.template = "NEON_PLASMA";
  raw.form.submissionLayout = "SIDEWAYS";
  const out = normalizeModelOutput(raw, { maxFields: 10 });
  assert.equal(out.draft!.template, "CLASSIC");
  assert.equal(out.draft!.submissionLayout, "ONE_AT_A_TIME");
  assert.equal(out.draft!.fields.length, 10);
});

test("reply-only output (question/refusal) yields no draft", () => {
  const out = normalizeModelOutput({ reply: "What is the form for?", form: { title: "", description: "", template: "CLASSIC", submissionLayout: "ONE_AT_A_TIME", fields: [] } }, opts);
  assert.equal(out.draft, null);
  assert.equal(out.reply, "What is the form for?");
});

test("unusable outputs throw so the orchestrator can fall back", () => {
  assert.throws(() => normalizeModelOutput("nope", opts));
  assert.throws(() => normalizeModelOutput(JSON.parse(goodJson({ fields: [f({ type: "PASSWORD" })] })), opts));
});

test("parseModelJson tolerates fences and prose, rejects garbage", () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Sure! {"a":1} hope that helps'), { a: 1 });
  assert.throws(() => parseModelJson("no json here"));
  assert.throws(() => parseModelJson('{"a":'));
});

const empty = { title: "", description: "", template: "CLASSIC", submissionLayout: "ONE_AT_A_TIME", fields: [] as unknown[] };

test("SCOPE GATE: only BUILD may carry a form — fields on any other intent are discarded", () => {
  const withFields = { ...empty, title: "Sneaky", fields: [f({ label: "Q1" })] };
  for (const intent of ["OFF_TOPIC", "CHAT", "CLARIFY"]) {
    const out = normalizeModelOutput({ intent, reply: "Nope, forms only!", form: withFields }, opts);
    assert.equal(out.draft, null, intent);
    assert.equal(out.intent, intent);
  }
});

test("SCOPE GATE: non-BUILD replies are hard-capped, so the model can't smuggle in an answer", () => {
  const essay = "Sure! Here is the answer to your question. ".repeat(60);
  const out = normalizeModelOutput({ intent: "OFF_TOPIC", reply: essay, form: empty }, opts);
  assert.ok(out.reply.length <= LIMITS.replyOther + 1, `got ${out.reply.length}`);
  const built = normalizeModelOutput(JSON.parse(goodJson({ reply: essay })), opts);
  assert.ok(built.reply.length <= LIMITS.reply + 1);
});

test("BUILD with no fields degrades to CLARIFY; missing intent is inferred; empty reply gets a friendly fallback", () => {
  const a = normalizeModelOutput({ intent: "BUILD", reply: "What is it for?", form: empty }, opts);
  assert.equal(a.intent, "CLARIFY");
  assert.equal(a.draft, null);
  const b = normalizeModelOutput({ reply: "hi", form: { ...empty, fields: [f({ label: "Q" })] } }, opts);
  assert.equal(b.intent, "BUILD");
  const c = normalizeModelOutput({ intent: "OFF_TOPIC", reply: "", form: empty }, opts);
  assert.match(c.reply, /form/i);
});

test("clipReply prefers sentence boundaries", () => {
  const out = clipReply("This is the first sentence right here. Second sentence goes on and on and on.", 50);
  assert.equal(out, "This is the first sentence right here.");
});
