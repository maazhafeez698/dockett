"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppShell } from "~/components/app-shell";
import { AiGenerateBar } from "~/components/ai-generate-bar";
import { AiFormBuilderPanel } from "~/components/ai-form-builder/panel";
import { DashboardLeftPanel } from "~/components/dashboard-left-panel";
import { DashboardRightPanel } from "~/components/dashboard-right-panel";
import { FormTicketCard } from "~/components/form-ticket-card";
import { useCreateForm, useListForms } from "~/hooks/api/form";
import { useTotalResponses } from "~/hooks/api/analytics";
import { useUser } from "~/hooks/api/auth";
import { useAuthGuard } from "~/hooks/use-auth-guard";

export default function DashboardCreatePage() {
  const router = useRouter();
  const { ready } = useAuthGuard();
  const { user } = useUser();
  const { forms, isLoading } = useListForms(ready);
  const { createFormAsync, isPending: creatingBlank } = useCreateForm();
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>();

  const published = (forms ?? []).filter((f) => f.status === "PUBLISHED");
  const { total: replies, isLoading: repliesLoading } = useTotalResponses(
    published.map((f) => f.id),
    ready,
  );

  const recent = [...(forms ?? [])]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 4);

  const openAi = (prompt: string) => {
    setPendingPrompt(prompt); // the panel sends it once, as soon as it opens
    setAiOpen(true);
  };

  const handleStartBlank = async () => {
    try {
      const created = await createFormAsync({ title: "Untitled Form" });
      router.push(`/dashboard/forms/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create form");
    }
  };

  if (!ready) return null;

  return (
    <AppShell docLabel="Create form">
      <div className="grid gap-4 p-3 sm:p-4 lg:p-5 xl:grid-cols-[216px_minmax(0,1fr)_268px]">
        <div className="order-2 xl:order-1">
          <DashboardLeftPanel
            totalForms={forms?.length ?? 0}
            publishedForms={published.length}
            replies={replies}
            loading={isLoading || repliesLoading}
          />
        </div>

        <div className="order-1 min-w-0 space-y-5 xl:order-2">
          <AiGenerateBar
            onGenerate={openAi}
            onStartBlank={handleStartBlank}
            blankPending={creatingBlank}
          />

          <section aria-labelledby="your-forms">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 id="your-forms" className="text-sm font-bold">
                Your forms
              </h2>
              {(forms?.length ?? 0) > 4 ? (
                <Link
                  href="/dashboard/forms"
                  className="mono-label text-muted-foreground hover:text-foreground"
                >
                  View all {forms?.length} →
                </Link>
              ) : null}
            </div>

            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[132px] animate-pulse border border-border bg-card" />
                ))}
              </div>
            ) : recent.length > 0 ? (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {recent.map((form, i) => (
                  <FormTicketCard key={form.id} form={form} index={i} />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-foreground/40 p-8 text-center">
                <p className="font-display text-xl font-extrabold">No forms issued yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user?.fullName ? `${user.fullName.split(" ")[0]}, d` : "D"}escribe one above, or
                  start from a template.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="order-3">
          <DashboardRightPanel onAiPrompt={openAi} />
        </div>
      </div>

      <AiFormBuilderPanel
        open={aiOpen}
        onOpenChange={setAiOpen}
        mode="NEW_FORM"
        initialPrompt={pendingPrompt}
        onInitialPromptConsumed={() => setPendingPrompt(undefined)}
      />
    </AppShell>
  );
}
