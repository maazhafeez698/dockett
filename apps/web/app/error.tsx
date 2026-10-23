"use client";

export default function AppErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="ticket-page-background flex min-h-dvh items-center justify-center p-4">
      <section
        role="alert"
        className="w-full max-w-md border border-foreground/70 bg-card p-6 text-center shadow-[5px_5px_0_0_var(--hard-shadow)] sm:p-8"
      >
        <p className="mono-label-sm text-muted-foreground">Something went wrong</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">We couldn&apos;t load this page.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again. If the problem continues, come back in a little while.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 border border-foreground/70 bg-primary px-4 py-2 font-mono text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
