// apps/web/app/dashboard/forms/page.tsx

"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { useDeleteForm, useListForms } from "~/hooks/api/form";
import { getFormTheme } from "~/lib/form-themes";
import { AppShell } from "~/components/app-shell";
import { DashboardRightPanel } from "~/components/dashboard-right-panel";
import { AiGenerateBar } from "~/components/ai-generate-bar";
import { Button } from "~/components/ui/button";

export default function DashboardForms() {
  const { forms, isLoading } = useListForms();
  const { deleteFormAsync } = useDeleteForm();

  const handleDeleteForm = async (formId: string) => {
    if (!confirm("Delete this form and all of its fields and submissions? This can't be undone."))
      return;
    await deleteFormAsync({ formId });
  };

  const totalForms = forms?.length ?? 0;
  const publishedForms = forms?.filter((f) => f.status === "PUBLISHED").length ?? 0;

  return (
    <AppShell
      rightPanel={<DashboardRightPanel totalForms={totalForms} publishedForms={publishedForms} />}
    >
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <AiGenerateBar />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Your forms</h2>
          </div>

          {isLoading ? (
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
              Loading forms...
            </div>
          ) : forms && forms.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {forms.map((form) => {
                const theme = getFormTheme(form.theme);
                return (
                  <Link
                    key={form.id}
                    href={`/dashboard/forms/${form.id}`}
                    className="glass group relative overflow-hidden rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{
                        background: `linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                      }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{form.title}</h3>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {form.description || "No description"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteForm(form.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {form.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No forms yet — describe one above, or hit Create Form.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
