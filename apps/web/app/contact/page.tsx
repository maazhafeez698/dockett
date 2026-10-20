import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal-page";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Contact the Dockett team by email.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      description="For questions about Dockett, please get in touch by email."
    >
      <LegalSection title="Email">
        <p>
          <a className="text-primary underline-offset-4 hover:underline" href="mailto:maazhafeez.dev@gmail.com">
            maazhafeez.dev@gmail.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
