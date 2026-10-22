import Link from "next/link";
import { Logo } from "~/components/logo";
import { ScrollExperience } from "~/components/scroll-experience";

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollExperience>
      <div className="min-h-screen bg-background">
        <header className="border-b border-foreground/70">
          <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 sm:px-8">
            <Link href="/" aria-label="Dockett home">
              <Logo size={22} />
            </Link>
            <Link
              href="/"
              className="mono-label-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to home
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <div data-scroll-reveal>
            <p className="mono-label-sm text-muted-foreground">Dockett · Company</p>
            <h1 className="font-display mt-3 text-4xl font-extrabold sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="prose-dockett mt-10 space-y-8">{children}</div>
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-5 py-5 text-sm text-muted-foreground sm:px-8">
            <Link className="hover:text-foreground" href="/about">
              About
            </Link>
            <Link className="hover:text-foreground" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-foreground" href="/terms">
              Terms
            </Link>
            <Link className="hover:text-foreground" href="/contact">
              Contact us
            </Link>
          </div>
        </footer>
      </div>
    </ScrollExperience>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-scroll-reveal>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
