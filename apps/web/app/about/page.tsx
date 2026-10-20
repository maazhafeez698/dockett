import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "About",
  description: "About Dockett, a tool for creating and sharing forms.",
};

export default function AboutPage() {
  return (
    <LegalPage
      title="About Dockett"
      description="Dockett helps people create, publish, and collect responses to forms."
    >
      <LegalSection title="What you can do">
        <p>
          Create forms with a visual builder or AI-assisted drafting, choose how questions are
          presented, and share a link so people can respond. Form owners can review responses and
          use the available form analytics and export tools.
        </p>
      </LegalSection>
      <LegalSection title="A practical tool">
        <p>
          Dockett is designed for everyday workflows such as applications, event sign-ups, feedback,
          and requests. The features available to an account may depend on its plan and the current
          product configuration.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
