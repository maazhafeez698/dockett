// apps/web/app/page.tsx
//
// Signed-out visitors see the Dockett landing page; signed-in users are
// redirected to the dashboard's Create window (see <LandingPage />).

import { LandingPage } from "~/components/landing/landing-page";

export default function Home() {
  return <LandingPage />;
}
