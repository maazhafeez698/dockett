// apps/web/app/dashboard/forms/page.tsx
//
// FORMS — the full ledger of everything you've issued.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "~/components/app-shell";
import { StatusTag } from "~/components/form-ticket-card";
import { Button } from "~/components/ui/button";
import { useCreateForm, useDeleteForm, useListForms } from "~/hooks/api/form";
import { useAuthGuard } from "~/hooks/use-auth-guard";
import { getTemplateDesign } from "~/lib/template-designs";

const FILTERS = ["ALL", "PUBLISHED", "DRAFT", "CLOSED"] as const;

export default function DashboardForms() {
  const { ready } = useAuthGuard();
  const router = useRouter();
  const { forms, isLoading } = useListForms();
  const { createFormAsync } = useCreateForm();
  const { deleteFormAsync } = useDeleteForm();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleBlankForm() {
    setPendingId("__blank__");
    try {
      const { id } = await createFormAsync({ title: "Untitled form" });
      router.push(`/dashboard/forms/${id}`);
    } finally {
      setPendingId(null);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(forms ?? [])]
      .filter((f) => filter === "ALL" || f.status === filter)
      .filter((f) => !q || f.title.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }, [forms, query, filter]);

  const handleDeleteForm = async (formId: string) => {
    try {
      await deleteFormAsync({ formId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete form");
    }
  };

  if (!ready) return null;

  return (
    <AppShell docLabel="Forms">
      <div className="mx-auto max-w-5xl space-y-5 p-3 sm:p-4 lg:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-extrabold text-primary">Forms</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you&apos;ve issued — {forms?.length ?? 0} in total.
            </p>
          </div>
          <Button
            variant="ember"
            onClick={handleBlankForm}
            disabled={pendingId === "__blank__"}
          >
            {pendingId === "__blank__" ? "Creating…" : "+ New form"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 border border-input bg-card px-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring sm:max-w-xs">
            <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search forms"
              aria-label="Search forms"
              className="h-9 w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`mono-label-sm border px-2.5 py-2 transition-colors ${
                  filter === f
                    ? "border-solid bg-solid text-solid-foreground"
                    : "border-foreground/50 bg-secondary hover:bg-accent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse border border-border bg-card" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-foreground/40 p-10 text-center">
            <p className="font-display text-xl font-extrabold">
              {forms && forms.length > 0 ? "Nothing matches" : "No forms issued yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {forms && forms.length > 0
                ? "Try a different search or filter."
                : "Head to Create and describe your first one."}
            </p>
          </div>
        ) : (
          <ul className="border border-border bg-card">
            {visible.map((form, i) => {
              const design = getTemplateDesign(form.template);
              return (
                <li
                  key={form.id}
                  className="group flex items-center gap-3 border-b border-dashed border-border px-3 py-3 last:border-b-0 hover:bg-accent/50"
                >
                  <span className="mono-label w-7 shrink-0 text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link href={`/dashboard/forms/${form.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-display text-base font-bold tracking-[-0.02em]">
                      {form.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {form.description || "No description"}
                    </div>
                  </Link>
                  <span className="mono-label-sm hidden shrink-0 text-muted-foreground sm:inline">
                    {design.name}
                  </span>
                  <StatusTag status={form.status} suspended={form.planSuspended} />
                  <span className="hidden w-[84px] shrink-0 text-right font-mono text-[10px] text-muted-foreground md:inline">
                    {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteForm(form.id)}
                    aria-label={`Delete ${form.title}`}
                    className="shrink-0 p-1.5 text-muted-foreground opacity-60 transition-colors hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
