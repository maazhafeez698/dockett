import { test } from "node:test";
import assert from "node:assert/strict";
import { FormStreamParser } from "../stream-parser";
import { goodJson, baseField } from "./helpers";

function run(text: string, split: (t: string) => string[]) {
  let reply = "";
  const fields: any[] = [];
  const p = new FormStreamParser({ onReplyDelta: (d) => (reply += d), onFieldObject: (r) => fields.push(JSON.parse(r)) });
  for (const c of split(text)) p.feed(c);
  return { reply, fields, p };
}
const bySize = (n: number) => (t: string) => t.match(new RegExp(`[\\s\\S]{1,${n}}`, "g")) ?? [];

test("streams reply and complete fields identically for every chunk size", () => {
  const json = goodJson();
  for (const n of [1, 2, 3, 7, 50, 10_000]) {
    const { reply, fields } = run(json, bySize(n));
    assert.equal(reply, "Here you go! A tidy little form.", `chunk size ${n}`);
    assert.deepEqual(fields.map((f) => f.label), ["Your name", "How did we do?", "Favourite part"], `chunk size ${n}`);
    assert.deepEqual(fields[2].options, ["Food", "Service", "Vibes"]);
  }
});

test("decodes escapes, unicode escapes and astral characters split across chunks", () => {
  const reply = 'Line1\nQuote:" back\\slash \u00e9 😀 end';
  const json = JSON.stringify({ reply, form: { title: "", description: "", template: "CLASSIC", submissionLayout: "ONE_AT_A_TIME", fields: [] } });
  for (const n of [1, 2, 5]) {
    const out = run(json, bySize(n));
    assert.equal(out.reply, reply, `chunk size ${n}`);
  }
  // Force-escaped non-BMP (surrogate pair as \ud83d\ude00)
  const escaped = '{"reply":"hi \\ud83d\\ude00!","form":{"fields":[]}}';
  assert.equal(run(escaped, bySize(1)).reply, "hi 😀!");
});

test("never emits deltas containing a lone surrogate", () => {
  const deltas: string[] = [];
  const p = new FormStreamParser({ onReplyDelta: (d) => deltas.push(d), onFieldObject: () => {} });
  const json = JSON.stringify({ reply: "a😀b", form: { fields: [] } });
  for (const c of json) p.feed(c); // iterates by code point; also test code-unit feeding:
  const p2 = new FormStreamParser({ onReplyDelta: (d) => deltas.push(d), onFieldObject: () => {} });
  for (let i = 0; i < json.length; i++) p2.feed(json[i]!);
  for (const d of deltas) assert.doesNotMatch(d, /[\ud800-\udbff]$/);
});

test("ignores code-fence prefix and does not mistake 'reply' inside fields for the reply", () => {
  const json = "```json\n" + goodJson({ fields: [{ ...baseField, label: "reply", type: "TEXT", description: "reply: nested" }] }) + "\n```";
  const out = run(json, bySize(4));
  assert.equal(out.reply, "Here you go! A tidy little form.");
  assert.equal(out.fields.length, 1);
});

test("braces and quotes inside strings do not confuse field boundaries", () => {
  const tricky = { ...baseField, label: 'Is {this} "ok"? ]', type: "TEXT", description: "a } b { c" };
  const out = run(goodJson({ fields: [tricky, { ...baseField, label: "Second", type: "TEXT" }] }), bySize(3));
  assert.deepEqual(out.fields.map((f) => f.label), ['Is {this} "ok"? ]', "Second"]);
});

test("malformed or truncated input never throws", () => {
  for (const junk of ["", "{", '{"reply":"abc', "not json at all", '{"reply":}}}]]', '{"reply":"x","form":{"fields":[{"label":']) {
    assert.doesNotThrow(() => run(junk, bySize(2)));
  }
});

test("output is capped so a runaway stream cannot exhaust memory", () => {
  const p = new FormStreamParser({ onReplyDelta: () => {}, onFieldObject: () => {} });
  p.feed('{"reply":"');
  for (let i = 0; i < 30; i++) p.feed("x".repeat(10_000));
  assert.ok(p.text.length <= 200_000);
});
