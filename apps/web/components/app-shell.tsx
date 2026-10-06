// apps/web/components/app-shell.tsx

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FilePlus2, BarChart3, LayoutTemplate, Settings, LogOut, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { useCreateForm } from "~/hooks/api/form";
import { LogoutConfirm } from "~/components/logout-confirm";

const NAV_ITEMS = [
  { href: "/dashboard/forms", label: "Forms", icon: FilePlus2, isCreate: true },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, isCreate: false },
  { href: "/dashboard/templates", label: "Form Templates", icon: LayoutTemplate, isCreate: false },
  { href: "/dashboard/billing", label: "Plans & Billing", icon: CreditCard, isCreate: false },
  { href: "/dashboard/settings", label: "Profile & Settings", icon: Settings, isCreate: false },
] as const;

interface AppShellProps {
  children: ReactNode;
  /** Right-hand contextual panel. Omit for pages that don't need one. */
  rightPanel?: ReactNode;
}

export function AppShell({ children, rightPanel }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { createFormAsync } = useCreateForm();

  const handleCreateForm = async () => {
    try {
      const created = await createFormAsync({ title: "Untitled Form" });
      router.push(`/dashboard/forms/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create form");
    }
  };

  return (
    <div className="grid h-screen grid-cols-[72px_1fr] overflow-hidden bg-background lg:grid-cols-[240px_1fr]">
      {/* --- left nav rail --- */}
      <aside className="glass-flat flex flex-col border-r border-border/60 py-5">
        <div className="mb-6 flex justify-center px-4 lg:justify-start">
          <Link href="/dashboard/forms">
            {/* <Logo markOnly className="lg:hidden" /> */}
            <Logo className="hidden lg:flex" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.isCreate && pathname?.startsWith("/dashboard/forms/"));
            const Icon = item.icon;

            if (item.isCreate) {
              return (
                <div key={item.href} className="mb-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={handleCreateForm}
                    className="flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="hidden lg:inline">Create Form</span>
                  </button>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      pathname === item.href
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className="hidden size-4 lg:inline" />
                    <span className="hidden lg:inline">All Forms</span>
                    <span className="lg:hidden">{item.label}</span>
                  </Link>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 px-3 pt-3">
          <div className="flex items-center justify-center px-3 py-1 lg:justify-start">
            <ThemeToggle />
          </div>
          <LogoutConfirm>
            <button
              type="button"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </LogoutConfirm>
        </div>
      </aside>

      {/* --- center workspace + optional right panel --- */}
      <div
        className={`grid h-screen overflow-hidden ${rightPanel ? "grid-cols-1 xl:grid-cols-[1fr_320px]" : "grid-cols-1"}`}
      >
        <main className="overflow-y-auto">{children}</main>
        {rightPanel ? (
          <aside className="glass-flat hidden overflow-y-auto border-l border-border/60 xl:block">
            {rightPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
