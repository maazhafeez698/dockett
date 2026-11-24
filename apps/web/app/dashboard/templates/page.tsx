"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileStack, Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { TemplatePreviewDialog } from "~/components/template-preview-dialog";
import { FORM_TEMPLATES, type FormTemplate } from "~/lib/templates-data";
import { getTemplateDesign } from "~/lib/template-designs";
import { useCreateFormFromTemplate, useCreateForm } from "~/hooks/api/form";
import { AppShell } from "~/components/app-shell";
import { useBillingOverview } from "~/hooks/api/billing";
import { toastError } from "~/lib/plan-limit";
import { useAuthGuard } from "~/hooks/use-auth-guard";

export default function TemplatesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard();
  const [category, setCategory] = useState("All");
  const { createFormFromTemplateAsync, isPending: creatingFromTemplate } =
    useCreateFormFromTemplate();
  const { createFormAsync, isPending: creatingBlank } = useCreateForm();

  const { overview } = useBillingOverview(ready);
  const premiumUnlocked = overview?.plan.premiumTemplates ?? true; 

  const [previewing, setPreviewing] = useState<FormTemplate | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleUseTemplate(template: FormTemplate) {
    setPendingId(template.id);
    try {
      const { id } = await createFormFromTemplateAsync({
        title: template.name,
        description: template.description,
        template: template.template,
        submissionLayout: template.submissionLayout,
        fields: template.fields,
      });
      router.push(`/dashboard/forms/${id}`);
    } catch (err) {
      toastError(err, "Couldn't create the form", () => router.push("/dashboard/billing"));
    } finally {
      setPendingId(null);
    }
  }

  async function handleBlankForm() {
    setPendingId("__blank__");
    try {
      const { id } = await createFormAsync({ title: "Untitled form" });
      router.push(`/dashboard/forms/${id}`);
    } finally {
      setPendingId(null);
    }
  }

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(FORM_TEMPLATES.map((t) => getTemplateDesign(t.template).category)))],
    [],
  );
  const visible = FORM_TEMPLATES.filter(
    (t) => category === "All" || getTemplateDesign(t.template).category === category,
  );

  if (!ready) return null;

  return (
    <AppShell docLabel="Templates">
      <div className="mx-auto max-w-6xl space-y-5 p-3 sm:p-4 lg:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-extrabold text-primary">Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fields, structure and design are created instantly.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter templates">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`mono-label-sm border px-2.5 py-2 transition-colors ${
                  category === c
                    ? "border-solid bg-solid text-solid-foreground"
                    : "border-foreground/50 bg-secondary hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => {
            const design = getTemplateDesign(template.template);
            const busy = pendingId === template.id;
            const isPremiumTemplate = ["DEVELOPER", "RETRO", "TICKET"].includes(template.template);
            const locked = !premiumUnlocked && isPremiumTemplate;

            return (
              <article
                key={template.id}
                className="flex flex-col border border-border bg-card p-4 transition-colors hover:border-foreground/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex size-9 items-center justify-center rounded-[3px] text-white"
                    style={{ background: design.accent }}
                  >
                    <FileStack className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-1">
                    {isPremiumTemplate ? (
                      <span className="mono-label-sm border border-foreground/60 px-1.5 py-[3px]">▲ Pro</span>
                    ) : null}
                    <span className="mono-label-sm border border-foreground/60 px-1.5 py-[3px]">
                      {design.category}
                    </span>
                  </div>
                </div>

                <h3 className="font-display mt-3 text-xl leading-tight font-extrabold">{template.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {template.description}
                </p>

                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <span className="mono-label-sm text-muted-foreground">
                    {template.fields.length} fields
                  </span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setPreviewing(template)}>
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || creatingFromTemplate}
                      onClick={() =>
                        locked ? router.push("/dashboard/billing") : handleUseTemplate(template)
                      }
                    >
                      {busy ? "Creating..." : locked ? "Upgrade to use" : "Use template"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}

          <button
            type="button"
            onClick={handleBlankForm}
            disabled={creatingBlank}
            className="flex min-h-[180px] flex-col items-center justify-center gap-3 border border-dashed border-foreground/40 p-5 text-center transition-colors hover:border-primary hover:bg-card"
          >
            <div className="flex size-9 items-center justify-center rounded-[3px] border border-foreground/60">
              <Plus className="size-4" />
            </div>
            <div>
              <p className="font-display text-xl font-extrabold">Custom form</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start from a blank page and build every field yourself.
              </p>
            </div>
            <span className="mono-label-sm text-primary">
              {pendingId === "__blank__" ? "Creating..." : "Start blank →"}
            </span>
          </button>
        </div>

        <TemplatePreviewDialog
          template={previewing}
          open={!!previewing}
          onOpenChange={(open) => !open && setPreviewing(null)}
          onUseTemplate={(template) => {
            setPreviewing(null);
            handleUseTemplate(template);
          }}
        />
      </div>
    </AppShell>
  );
}
