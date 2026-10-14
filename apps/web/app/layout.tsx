import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";

export const metadata: Metadata = {
  title: {
    default: "Dockett — Every form, a ticket.",
    template: "%s · Dockett",
  },
  description:
    "Describe a form and Dockett builds it. Shape it on a canvas or a list, publish with one click, and give people a one-question-at-a-time experience they actually finish.",
  applicationName: "Dockett",
  openGraph: {
    title: "Dockett — Every form, a ticket.",
    description:
      "Describe a form and Dockett builds it. Publish with one click and give people a one-question-at-a-time experience they actually finish.",
    siteName: "Dockett",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E0D6" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D0C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}
