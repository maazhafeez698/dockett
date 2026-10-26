import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.JWT_SECRET ??= "test-jwt-secret-".padEnd(64, "x");
process.env.GOOGLE_CLIENT_ID ??= "test-client.apps.googleusercontent.com";
process.env.RESEND_API_KEY = "re_test_key";
process.env.EMAIL_FROM_NAME = "Dockett";
process.env.EMAIL_FROM_ADDRESS = "notifications@example.test";
process.env.EMAIL_REPLY_TO = "support@example.test";

const originalFetch = globalThis.fetch;

const loadResend = () => import("../resend");

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("sendEmail sends branded sender and reply-to through Resend", async () => {
  const { sendEmail } = await loadResend();
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ id: "email_test_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await sendEmail({
    to: "person@example.test",
    subject: "Verify your email",
    html: "<p>Confirm your address</p>",
    text: "Confirm your address",
  });

  assert.match(requestUrl, /^https:\/\/api\.resend\.com\/emails$/);
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get("authorization"), "Bearer re_test_key");
  const payload = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.equal(payload.from, "Dockett <notifications@example.test>");
  assert.equal(payload.to, "person@example.test");
  assert.equal(payload.reply_to, "support@example.test");
});

test("sendEmail surfaces provider rejections to existing caller error handling", async () => {
  const { sendEmail } = await loadResend();
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ statusCode: 403, message: "Domain is not verified" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    sendEmail({ to: "person@example.test", subject: "Test", html: "<p>Test</p>", text: "Test" }),
    /Domain is not verified/,
  );
});

test("existing branded verification, reset, and respondent emails use the centralized service", async () => {
  const { sendPasswordResetEmail, sendRespondentLinkEmail, sendVerificationEmail } = await import("../../user/email");
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ id: `email_test_${requests.length}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await sendVerificationEmail("new@example.test", "https://dockett.example/verify?token=token");
  await sendPasswordResetEmail("user@example.test", "https://dockett.example/reset?token=token");
  await sendRespondentLinkEmail("respondent@example.test", "https://dockett.example/form/123?rv=token", "Job Application");

  assert.equal(requests.length, 3);
  assert.match(String(requests[0]?.subject), /Verify your email/);
  assert.match(String(requests[0]?.html), /Welcome to Dockett/);
  assert.match(String(requests[0]?.text), /Confirm your email address/);
  assert.match(String(requests[1]?.subject), /Reset your password/);
  assert.match(String(requests[1]?.html), /Reset password/);
  assert.match(String(requests[2]?.subject), /Job Application/);
  assert.match(String(requests[2]?.html), /Continue to the form/);
});
