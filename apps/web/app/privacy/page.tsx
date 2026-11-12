import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Dockett handles information when you use the service.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      description="This policy explains what information Dockett uses to provide accounts, forms, and related features."
    >
      <LegalSection title="Information we handle">
        <p>
          Depending on how you use Dockett, information may include account details such as your
          name and email address, forms and questions you create, responses and files submitted to
          those forms, and information needed to operate and protect the service.
        </p>
      </LegalSection>
      <LegalSection title="How we use information">
        <p>
          We use information to provide and maintain Dockett, authenticate accounts, create and
          manage forms, deliver responses to form owners, provide requested features, respond to
          support questions, process subscriptions, and protect the service from abuse or
          unauthorized activity.
        </p>
        <p>
          If you use AI-assisted form drafting, the prompt and information you choose to include are
          sent to the AI provider used for that feature to generate suggestions. Avoid including
          sensitive information in prompts unless it is necessary.
        </p>
      </LegalSection>
      <LegalSection title="Forms and responses">
        <p>
          Form owners can view responses submitted to their forms. If you respond to a form, the
          form owner decides how to use and retain that response. Contact the form owner with
          questions about their form or the information you submitted.
        </p>
      </LegalSection>
      <LegalSection title="Payments and service providers">
        <p>
          We use service providers for hosting, storage, authentication, payment processing, and
          AI-assisted features. Paddle acts as the merchant of record for Dockett payments and
          handles payment details through its checkout. We receive information about the transaction
          and subscription needed to manage your account; payment details are handled by Paddle.
        </p>
      </LegalSection>
      <LegalSection title="Disclosure, retention, and security">
        <p>
          Service providers process information as needed to provide their services. We may also
          disclose information when required by law or when necessary to protect users, Dockett, or
          others. We keep information for as long as needed to provide the service, maintain
          accounts and forms, meet legal obligations, and address disputes. We use reasonable
          measures to protect information, but no online service can guarantee complete security.
        </p>
      </LegalSection>
      <LegalSection title="Your choices and privacy requests">
        <p>
          You can manage forms and responses using the controls available in Dockett. For questions
          about your information or a privacy request, contact{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href="mailto:maazhafeez.dev@gmail.com"
          >
            maazhafeez.dev@gmail.com
          </a>
          . If you submitted information through someone else’s form, contact that form owner about
          their use of your response.
        </p>
      </LegalSection>
      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy as Dockett changes. The current version will be published on
          this page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
