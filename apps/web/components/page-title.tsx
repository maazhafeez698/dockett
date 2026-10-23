"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Dockett",
  "/signin": "Sign in",
  "/signup": "Create account",
  "/forgot-password": "Forgot password",
  "/reset-password": "Reset password",
  "/verify-email": "Verify email",
  "/about": "About",
  "/contact": "Contact",
  "/privacy": "Privacy policy",
  "/terms": "Terms of service",
  "/dashboard": "Create form",
  "/dashboard/forms": "Forms",
  "/dashboard/analytics": "Analytics",
  "/dashboard/templates": "Templates",
  "/dashboard/billing": "Plans & billing",
  "/dashboard/settings": "Settings",
};

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/dashboard/forms/")) return "Form builder";
  if (pathname.startsWith("/form/")) return "Fill out form";
  return TITLES[pathname] ?? "Dockett";
}

export function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const title = titleForPath(pathname);
    document.title = title === "Dockett" ? title : `${title} · Dockett`;
  }, [pathname]);

  return null;
}
