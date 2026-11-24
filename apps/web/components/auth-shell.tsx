import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Link href="/" aria-label="Dockett home" className="mb-5">
        <Logo size={22} />
      </Link>
      <div className="w-full max-w-[400px] border border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_var(--hard-shadow)] sm:p-7">
        <h1 className="font-display text-[30px] leading-none font-extrabold text-primary">{title}</h1>
        {subtitle ? <p className="mt-2.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-5">{children}</div>
      </div>
      <p className="mono-label-sm mt-6 text-muted-foreground">Every form, a ticket.</p>
    </main>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="mono-label-sm text-muted-foreground">or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// Only follow same-site relative paths from ?next= 
export function safeNext(): string {
  if (typeof window === "undefined") return "/dashboard";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
