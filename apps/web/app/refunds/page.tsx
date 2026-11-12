import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How to request a refund for a Dockett subscription.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund policy"
      description="This policy explains how cancellations and refund requests work for paid Dockett plans."
    >
      <LegalSection title="Subscription cancellations">
        <p>
          You can manage or cancel a subscription from the subscription-management option on your
          Dockett billing page. Cancellation stops future renewals. Your paid features may remain
          available through the current billing period, as shown in your account.
        </p>
        <p>
          Canceling a subscription does not automatically refund a payment that has already been
          processed.
        </p>
      </LegalSection>
      <LegalSection title="Requesting a refund">
        <p>
          If you believe you were charged in error or would like us to review a payment, contact us
          at{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href="mailto:maazhafeez.dev@gmail.com"
          >
            maazhafeez.dev@gmail.com
          </a>{" "}
          using the email address on your Dockett account. Include your Paddle receipt or
          transaction reference if available, but do not send full payment-card details.
        </p>
      </LegalSection>
      <LegalSection title="Review and processing">
        <p>
          Refund requests are reviewed based on the purchase details, the circumstances of the
          request, and applicable law. Any refund required by law will be provided. Paddle is the
          merchant of record and processes payments and approved refunds; the time for a refund to
          appear depends on the payment method and provider.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
