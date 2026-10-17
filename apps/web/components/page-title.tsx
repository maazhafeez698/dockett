"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/signin": "Sign in",
  "/signup": "Create account",
  "/forgot-password": "Forgot password",
  "/reset-password": "Reset password",
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
    document.title = `${titleForPath(pathname)} · Dockett`;
  }, [pathname]);

  return null;
}
