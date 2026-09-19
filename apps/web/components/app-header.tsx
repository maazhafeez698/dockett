// apps/web/components/app-header.tsx

import Link from "next/link";
import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard/forms">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
