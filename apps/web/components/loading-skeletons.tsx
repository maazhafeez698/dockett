import { Skeleton } from "~/components/ui/skeleton";

export function PageLoadingSkeleton() {
  return (
    <main className="ticket-page-background flex min-h-dvh items-center justify-center p-5">
      <section className="w-full max-w-xl border border-border bg-card p-6 sm:p-9" aria-label="Loading page">
        <Skeleton className="h-3 w-28 rounded-none" />
        <Skeleton className="mt-6 h-10 w-3/4 rounded-none" />
        <Skeleton className="mt-3 h-4 w-full rounded-none" />
        <Skeleton className="mt-2 h-4 w-2/3 rounded-none" />
        <div className="mt-8 space-y-5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="border-b border-dashed border-border pb-5">
              <Skeleton className="h-3 w-1/3 rounded-none" />
              <Skeleton className="mt-3 h-11 w-full rounded-none" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export function WorkspaceContentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-3 sm:p-4 lg:p-5" aria-label="Loading workspace">
      <div className="border-b border-dashed border-border pb-4">
        <Skeleton className="h-9 w-56 rounded-none" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full rounded-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="border border-border bg-card p-4">
            <Skeleton className="h-3 w-20 rounded-none" />
            <Skeleton className="mt-4 h-6 w-3/4 rounded-none" />
            <Skeleton className="mt-3 h-3 w-full rounded-none" />
            <Skeleton className="mt-2 h-3 w-2/3 rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicFormSkeleton() {
  return (
    <main className="ticket-page-background min-h-dvh p-4 sm:p-8" aria-label="Loading form">
      <div className="mx-auto grid min-h-[70vh] max-w-6xl overflow-hidden border border-border bg-card lg:grid-cols-[0.8fr_1.2fr]">
        <div className="border-b border-border bg-primary/10 p-6 sm:p-10 lg:border-r lg:border-b-0">
          <Skeleton className="h-3 w-32 rounded-none" />
          <Skeleton className="mt-7 h-10 w-4/5 rounded-none" />
          <Skeleton className="mt-4 h-4 w-full rounded-none" />
          <Skeleton className="mt-2 h-4 w-3/4 rounded-none" />
          <div className="mt-9 space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-none" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-7 p-6 sm:p-10">
          {[0, 1, 2].map((item) => (
            <div key={item} className="border-b border-dashed border-border pb-6">
              <Skeleton className="h-4 w-1/2 rounded-none" />
              <Skeleton className="mt-3 h-12 w-full rounded-none" />
            </div>
          ))}
          <Skeleton className="h-10 w-32 rounded-none" />
        </div>
      </div>
    </main>
  );
}
