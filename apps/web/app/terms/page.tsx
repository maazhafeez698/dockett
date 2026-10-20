import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Basic rules for using Dockett.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      description="These terms set out the basic rules for using Dockett."
    >
      <LegalSection title="Using Dockett">
        <p>
          By using Dockett, you agree to follow these terms and applicable laws. Keep your account
          information accurate, protect your sign-in credentials, and take responsibility for
          activity under your account.
        </p>
      </LegalSection>
      <LegalSection title="Your content">
        <p>
          You are responsible for the forms, questions, files, and responses you create, share, or
          submit. Only use content you have permission to use, and do not collect information
          unlawfully or violate another person’s rights.
        </p>
        <p>
          You allow Dockett to host and process your content as needed to provide the service, such
          as displaying forms and delivering responses to their owners.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <p>
          Do not misuse or disrupt Dockett, access accounts or data without permission, upload
          malicious content, or use the service for unlawful, deceptive, harmful, or abusive
          activity. Do not use forms to spam, harass, or collect information without an appropriate
          reason and notice.
        </p>
        <p>
          We may remove content or limit or suspend access when needed to enforce these terms,
          address abuse or security risks, or comply with law.
        </p>
      </LegalSection>
      <LegalSection title="Plans and payments">
        <p>
          Paid features, if offered, are subject to the price and billing details shown when you
          purchase them. Any cancellation or refund terms presented at checkout also apply.
        </p>
      </LegalSection>
      <LegalSection title="Service availability and changes">
        <p>
          We work to keep Dockett available, but do not guarantee uninterrupted or error-free
          service. Features may change or be discontinued as the product develops.
        </p>
      </LegalSection>
      <LegalSection title="Disclaimer">
        <p>
          Dockett is provided on an “as available” basis. To the extent permitted by law, we do not
          make guarantees that the service will always meet your needs or remain uninterrupted.
        </p>
      </LegalSection>
      <LegalSection title="Contact and legal rights">
        <p>
          If you have questions about these terms, contact{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href="mailto:maazhafeez.dev@gmail.com"
          >
            maazhafeez.dev@gmail.com
          </a>
          . These terms do not limit rights or protections that cannot be limited under applicable
          law.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
