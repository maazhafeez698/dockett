import { test } from "node:test";
import assert from "node:assert/strict";

import {
  kindFromFilename,
  mimeCompatible,
  sanitizeDisplayName,
  sniffKind,
} from "../kinds";
import { SlidingWindowLimiter } from "../rate-limit";

const bytes = (...n: number[]) => Uint8Array.from(n);
const text = (s: string) => Uint8Array.from(Array.from(s).map((c) => c.charCodeAt(0)));

test("kindFromFilename trusts only the last extension", () => {
  assert.equal(kindFromFilename("cv.PDF"), "pdf");
  assert.equal(kindFromFilename("photo.jpeg"), "jpg");
  assert.equal(kindFromFilename("a/b\\c.docx"), "docx");
  assert.equal(kindFromFilename("invoice.pdf.exe"), null);
  assert.equal(kindFromFilename("noext"), null);
  assert.equal(kindFromFilename(".png"), null);
  assert.equal(kindFromFilename("x.zip"), null);
});

test("mimeCompatible tolerates missing/generic types but rejects a wrong explicit one", () => {
  assert.equal(mimeCompatible("pdf", "application/pdf"), true);
  assert.equal(mimeCompatible("pdf", ""), true);
  assert.equal(mimeCompatible("pdf", "image/png"), false);
  assert.equal(mimeCompatible("jpg", "image/jpeg"), true);
  assert.equal(mimeCompatible("png", "text/html"), false);
});

test("sniffKind recognises real signatures only", () => {
  assert.equal(sniffKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), "png");
  assert.equal(sniffKind(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), "jpg");
  assert.equal(sniffKind(text("%PDF-1.7\n%âãÏÓ")), "pdf");
  assert.equal(sniffKind(text("\n\n%PDF-1.4")), "pdf");
  assert.equal(sniffKind(text("PK\u0003\u0004....[Content_Types].xml....")), "docx");
  // a bare zip is not a docx
  assert.equal(sniffKind(text("PK\u0003\u0004....readme.txt....")), null);
  // HTML / script renamed to .pdf
  assert.equal(sniffKind(text("<html><script>alert(1)</script>")), null);
  assert.equal(sniffKind(text("MZ\u0090\u0000\u0003")), null);
  assert.equal(sniffKind(bytes(1, 2)), null);
});

test("sanitizeDisplayName strips paths, markup and control characters", () => {
  assert.equal(sanitizeDisplayName("C:\\fake\\path\\résumé.pdf"), "résumé.pdf");
  assert.equal(sanitizeDisplayName("<img src=x onerror=1>.png"), "img src=x onerror=1.png");
  assert.equal(sanitizeDisplayName("a\u0000b\u202e.pdf"), "ab.pdf");
  assert.equal(sanitizeDisplayName("...."), "file");
  assert.ok(sanitizeDisplayName("x".repeat(500) + ".pdf").length <= 120);
});

test("SlidingWindowLimiter blocks after the limit and recovers", () => {
  const l = new SlidingWindowLimiter(3, 1000);
  assert.equal(l.hit("a", 0).ok, true);
  assert.equal(l.hit("a", 10).ok, true);
  assert.equal(l.hit("a", 20).ok, true);
  const blocked = l.hit("a", 30);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(l.hit("b", 30).ok, true); // other keys unaffected
  assert.equal(l.hit("a", 1100).ok, true); // window slid
});

test("SlidingWindowLimiter bounds memory", () => {
  const l = new SlidingWindowLimiter(1, 60_000, 100);
  for (let i = 0; i < 500; i++) l.hit(`k${i}`, i);
  assert.ok(l.size <= 100 + 1);
});
