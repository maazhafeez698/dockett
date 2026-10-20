import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Dockett handles information when you use the service.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      description="This notice explains what information Dockett uses to provide forms, accounts, and related features."
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
          support questions, and protect the service from abuse or unauthorized activity.
        </p>
        <p>
          When you use AI-assisted form drafting, the prompt and information you choose to include
          are sent to the AI service used to provide that feature so it can generate suggestions.
          Avoid including sensitive information in prompts unless necessary.
        </p>
      </LegalSection>
      <LegalSection title="Forms and responses">
        <p>
          Form owners can view responses submitted to their forms. If you respond to a form, the
          form owner is responsible for how they use and retain your response. Contact the form
          owner with questions about their form or the information you submitted.
        </p>
      </LegalSection>
      <LegalSection title="Service providers and disclosures">
        <p>
          Dockett uses service providers to support functions such as hosting, storage,
          authentication, payments, and AI-assisted features. These providers process information
          as needed to perform services for the platform.
        </p>
        <p>
          Information may also be disclosed when required by law or when necessary to protect users,
          the service, or others.
        </p>
      </LegalSection>
      <LegalSection title="Retention and security">
        <p>
          Information is retained for as long as needed to provide the service, maintain accounts
          and forms, meet legal obligations, and address disputes. Retention may vary depending on
          the type of information and the feature used. We use reasonable measures to protect
          information, but no online service can guarantee complete security.
        </p>
      </LegalSection>
      <LegalSection title="Your choices and contact">
        <p>
          You can manage forms and responses using the controls available in Dockett. For questions
          about your information or a privacy request, contact{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href="mailto:maazhafeez.dev@gmail.com"
          >
            maazhafeez.dev@gmail.com
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title="Updates">
        <p>
          We may update this notice as Dockett changes. The current version will be published on
          this page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
