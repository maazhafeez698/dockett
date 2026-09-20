// apps/web/app/dashboard/analytics/page.tsx

"use client";

import { useListForms } from "~/hooks/api/form";
import { AppShell } from "~/components/app-shell";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const { forms, isLoading } = useListForms();

  const totalForms = forms?.length ?? 0;
  const publishedForms = forms?.filter((f) => f.status === "PUBLISHED").length ?? 0;
  const draftForms = forms?.filter((f) => f.status === "DRAFT").length ?? 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick overview for now — per-field breakdowns, response timelines, and completion
            rates land in a dedicated analytics phase.
          </p>
        </div>

        {isLoading ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass rounded-2xl p-5">
              <div className="text-3xl font-semibold">{totalForms}</div>
              <div className="text-sm text-muted-foreground">Total forms</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-3xl font-semibold">{publishedForms}</div>
              <div className="text-sm text-muted-foreground">Published</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-3xl font-semibold">{draftForms}</div>
              <div className="text-sm text-muted-foreground">Drafts</div>
            </div>
          </div>
        )}

        <div className="glass-strong flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15">
            <BarChart3 className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Detailed analytics is on the roadmap</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Per-field response breakdowns, submission timelines, completion rates, and CSV export
            are scoped as their own phase, built on top of real submission data.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
