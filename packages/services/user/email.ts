import { env } from "../env";
import { sendEmail } from "../email/resend";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

interface BrandedEmailOptions {
  to: string;
  subject: string;
  eyebrow: string;
  title: string;
  message: string;
  buttonLabel: string;
  buttonUrl: string;
  note: string;
}

async function sendBrandedEmail({ to, subject, eyebrow, title, message, buttonLabel, buttonUrl, note }: BrandedEmailOptions) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeButtonLabel = escapeHtml(buttonLabel);
  const safeButtonUrl = escapeHtml(buttonUrl);
  const safeNote = escapeHtml(note);

  const html = `
    <div style="margin:0;padding:32px 16px;background:#e4e0d6;color:#181818;font-family:Poppins,Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto;border-collapse:collapse;">
        <tr><td style="height:8px;background:#e8480c;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 32px 32px;background:#f4f1ea;border:1px solid #c9c4b9;">
            <p style="margin:0 0 28px;color:#e8480c;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:3px;">DOCKETT<span style="color:#181818;"> / FORMS</span></p>
            <p style="margin:0 0 10px;color:#6b675e;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${safeEyebrow}</p>
            <h1 style="margin:0 0 14px;color:#181818;font-size:28px;line-height:1.2;font-weight:700;">${safeTitle}</h1>
            <p style="margin:0 0 26px;color:#45423c;font-size:15px;line-height:1.7;">${safeMessage}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 26px;">
              <tr><td style="background:#e8480c;border:1px solid #181818;box-shadow:4px 4px 0 #181818;">
                <a href="${safeButtonUrl}" style="display:inline-block;padding:14px 22px;color:#f4f1ea;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-decoration:none;text-transform:uppercase;">${safeButtonLabel}</a>
              </td></tr>
            </table>
            <p style="margin:0;padding-top:18px;border-top:1px solid #d5d0c5;color:#6b675e;font-size:12px;line-height:1.6;">${safeNote}</p>
          </td>
        </tr>
        <tr><td style="padding:16px 4px;color:#6b675e;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;">Dockett · Make forms people want to finish.</td></tr>
      </table>
    </div>
  `;
  const text = `DOCKETT / FORMS\n${eyebrow}\n\n${title}\n\n${message}\n\n${buttonLabel}: ${buttonUrl}\n\n${note}\n\nDockett · Make forms people want to finish.`;

  await sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendBrandedEmail({
    to,
    subject: "Reset your password",
    eyebrow: "Account security",
    title: "Reset your password",
    message: `We received a request to reset the password for your account. This link expires in ${env.RESET_TOKEN_TTL_MINUTES} minutes.`,
    buttonLabel: "Reset password",
    buttonUrl: resetUrl,
    note: "If you didn't request this, you can safely ignore this email. Your password will not be changed.",
  });
}

/** Dockett sign-up: confirm the address and finish creating the account. */
export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await sendBrandedEmail({
    to,
    subject: "Verify your email for Dockett",
    eyebrow: "Welcome to Dockett",
    title: "Verify your email",
    message: `Confirm your email address to finish creating your account. This link works once and expires in ${env.EMAIL_VERIFY_TTL_MINUTES} minutes.`,
    buttonLabel: "Verify email",
    buttonUrl: verifyUrl,
    note: "If you didn't create a Dockett account, you can ignore this email.",
  });
}

/** A respondent proving they own the address they will answer a form with. */
export async function sendRespondentLinkEmail(to: string, linkUrl: string, formTitle: string) {
  await sendBrandedEmail({
    to,
    subject: `Confirm your email — ${formTitle.slice(0, 80)}`,
    eyebrow: "One-time form link",
    title: "Confirm your email",
    message: `Open this link to continue to “${formTitle}”. It works once and expires in ${env.RESPONDENT_LINK_TTL_MINUTES} minutes. You don't need a Dockett account.`,
    buttonLabel: "Continue to the form",
    buttonUrl: linkUrl,
    note: "If you didn't ask for this, you can ignore this email.",
  });
}
