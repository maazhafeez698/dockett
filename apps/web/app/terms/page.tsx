import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Dockett.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      description="These terms explain the basic rules for using Dockett, a tool for creating and sharing forms."
    >
      <LegalSection title="Using the service">
        <p>
          By creating an account or using Dockett, you agree to these terms and applicable law. You
          must provide accurate account information, keep your sign-in credentials secure, and take
          responsibility for activity under your account.
        </p>
      </LegalSection>
      <LegalSection title="Forms and content">
        <p>
          You are responsible for the forms, questions, files, and responses you create, share, or
          submit. Use only content you have permission to use, respect others’ rights, and give
          people appropriate notice when collecting their information.
        </p>
        <p>
          You give Dockett permission to host, store, and process your content as needed to operate
          the service, including displaying forms and delivering responses to their owners.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <p>
          Do not use Dockett to break the law, infringe another person’s rights, send spam or
          harassment, collect information without an appropriate reason or notice, or upload
          malicious content. Do not disrupt the service or access accounts or data without
          permission.
        </p>
        <p>
          We may remove content or limit or suspend access when reasonably needed to enforce these
          terms, address abuse or security risks, or comply with law.
        </p>
      </LegalSection>
      <LegalSection title="Plans, payments, and cancellation">
        <p>
          Some features are available on paid plans. The price, billing period, and any applicable
          taxes are shown at checkout before you purchase. Payments are processed by Paddle, which
          acts as the merchant of record for those transactions.
        </p>
        <p>
          Subscriptions renew as described at checkout unless canceled. You can manage or cancel a
          Paddle subscription through the subscription-management option in your Dockett billing
          page. A cancellation stops future renewals; access to paid features may continue through
          the current billing period as shown in your account. Cancellation does not automatically
          refund a payment already made. See our{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href="/refunds">
            Refund policy
          </Link>{" "}
          for how to request a refund.
        </p>
      </LegalSection>
      <LegalSection title="Service changes and availability">
        <p>
          We work to keep Dockett available and useful, but the service may occasionally be
          interrupted or contain errors. Features may change or be discontinued as the product
          develops.
        </p>
      </LegalSection>
      <LegalSection title="Disclaimers and legal rights">
        <p>
          Dockett is provided on an “as available” basis. To the extent permitted by law, we make no
          guarantees that the service will always meet your needs or remain uninterrupted. Nothing
          in these terms limits rights or protections that cannot be limited under applicable law.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          If you have questions about these terms, email us at{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href="mailto:maazhafeez.dev@gmail.com"
          >
            maazhafeez.dev@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
