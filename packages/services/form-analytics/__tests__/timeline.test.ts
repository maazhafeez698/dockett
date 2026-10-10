import assert from "node:assert/strict";
import { test } from "node:test";

import { buildResponseTimeline } from "../timeline";

test("groups responses by the viewer's calendar day and includes today's responses", () => {
  const now = new Date("2026-10-10T13:15:00.000Z");
  const timeline = buildResponseTimeline(
    [
      { createdAt: new Date("2026-10-10T07:15:00.000Z") },
      { createdAt: new Date("2026-10-09T20:30:00.000Z") },
      { createdAt: null },
    ],
    "Asia/Karachi",
    now,
  );

  assert.equal(timeline.length, 14);
  assert.equal(timeline.at(-1)?.date, "2026-10-10");
  assert.equal(timeline.at(-1)?.count, 2);
});

test("keeps the timeline's latest day aligned with UTC viewers", () => {
  const timeline = buildResponseTimeline(
    [{ createdAt: new Date("2026-10-10T23:30:00.000Z") }],
    "UTC",
    new Date("2026-10-10T23:45:00.000Z"),
  );

  assert.equal(timeline.at(-1)?.date, "2026-10-10");
  assert.equal(timeline.at(-1)?.count, 1);
});
