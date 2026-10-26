import { Resend } from "resend";
import { env } from "../env";

const resend = new Resend(env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const from = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`;
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
  });

  if (error) throw new Error(`Resend email delivery failed: ${error.message}`);
}
