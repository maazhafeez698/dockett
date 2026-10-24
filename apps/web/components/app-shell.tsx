"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { LogoutConfirm } from "~/components/logout-confirm";
import { DocStrip, pad2 } from "~/components/doc-strip";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { useListForms } from "~/hooks/api/form";

const NAV_ITEMS = [
  { n: "01", href: "/dashboard", label: "Create" },
  { n: "02", href: "/dashboard/forms", label: "Forms" },
  { n: "03", href: "/dashboard/analytics", label: "Analytics" },
  { n: "04", href: "/dashboard/templates", label: "Templates" },
  { n: "05", href: "/dashboard/billing", label: "Billing" },
  { n: "06", href: "/dashboard/settings", label: "Settings" },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard") {
    // The builder lives under CREATE.
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/forms/");
  }
  return pathname === href;
}

function SidebarBody({ liveForms, onNavigate }: { liveForms: number; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Dockett — dashboard">
          <Logo size={24} />
        </Link>
      </div>

      <nav aria-label="Primary" className="px-3">
        <ul>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="border-b border-dashed border-border">
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`mono-label my-0.5 flex h-8 items-center gap-3 rounded-[2px] px-2.5 transition-colors ${
                    active
                      ? "bg-primary font-bold text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className={active ? "opacity-90" : "opacity-70"}>{item.n}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* wordmark + live counter */}
      <div className="mt-auto flex items-end gap-2 px-4 pb-3">
        <span
          aria-hidden="true"
          className="font-display shrink-0 rotate-180 text-[64px] leading-[0.82] font-extrabold text-primary [writing-mode:vertical-rl]"
        >
          dockett<span className="text-primary">.</span>
        </span>
        <div className="min-w-0 pb-1">
          <div className="mono-label-sm flex items-center gap-2 p-2 text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]" aria-hidden="true" />
            Forms live
          </div>
          <div className="numeral text-[88px]" aria-label={`${liveForms} forms live`}>
            {pad2(liveForms)}
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-border px-3 py-1.5">
        <ThemeToggle variant="row" />
        <LogoutConfirm>
          <button
            type="button"
            className="mono-label flex w-full items-center gap-2 px-3 py-2 text-muted-foreground transition-colors hover:text-destructive"
          >
            Sign out
          </button>
        </LogoutConfirm>
      </div>
    </div>
  );
}

interface AppShellProps {
  children: ReactNode;
  /** DOC STRIP page label, e.g. "CREATE FORM". */
  docLabel?: string;
  /**
   * true (default): the page scrolls inside the shell.
   * false: the page fills the shell and manages its own scrolling (builder).
   */
  scroll?: boolean;
}

export function AppShell({ children, docLabel = "WORKSPACE", scroll = true }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { forms } = useListForms();
  const liveForms = forms?.filter((f) => f.status === "PUBLISHED" && !f.planSuspended).length ?? 0;

  return (
    <div className="ticket-page-background flex h-dvh overflow-hidden">
      {/* desktop sidebar */}
      <aside className="hidden w-[232px] shrink-0 border-r border-border bg-card lg:block">
        <SidebarBody liveForms={liveForms} />
      </aside>

      {/* mobile nav sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[260px] gap-0 p-0 sm:max-w-[260px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody liveForms={liveForms} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3 lg:hidden">
          <Link href="/dashboard" aria-label="Dockett — dashboard">
            <Logo size={20} />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            className="flex size-9 items-center justify-center rounded-sm border border-border"
          >
            <Menu className="size-4" />
          </button>
        </div>

        <div className="shrink-0 px-3 pt-3 sm:px-4 lg:px-5 lg:pt-4">
          <DocStrip label={docLabel.toUpperCase()} zone={pad2(liveForms)} />
        </div>

        <main
          className={
            scroll
              ? "scrollbar-none min-h-0 flex-1 overflow-y-auto"
              : "flex min-h-0 flex-1 flex-col overflow-hidden"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
