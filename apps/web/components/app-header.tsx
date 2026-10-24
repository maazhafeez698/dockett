import Link from "next/link";
import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" aria-label="Dockett home">
          <Logo size={22} />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
