import nodemailer from "nodemailer";
import { env } from "../env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465 (implicit TLS), false for 587 (STARTTLS)
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>We received a request to reset the password for your account. This link expires in ${env.RESET_TOKEN_TTL_MINUTES} minutes.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Reset password
        </a>
      </p>
      <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
    </div>
  `;

  await transporter.sendMail({
    to,
    from: env.SMTP_FROM_EMAIL ?? env.SMTP_USER,
    subject: "Reset your password",
    html,
  });
}
