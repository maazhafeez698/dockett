// apps/web/app/dashboard/templates/page.tsx
//
// Gallery of 8 structurally distinct premium templates + a trailing
// "Custom Form" card. Preview opens the full form experience in a modal;
// Use Template creates the form (with fields + design pre-populated) and
// jumps straight into the builder canvas.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileStack, Lock, Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { TemplatePreviewDialog } from "~/components/template-preview-dialog";
import { FORM_TEMPLATES, type FormTemplate } from "~/lib/templates-data";
import { getTemplateDesign } from "~/lib/template-designs";
import { useCreateFormFromTemplate, useCreateForm } from "~/hooks/api/form";
import { AppShell } from "~/components/app-shell";
import { useBillingOverview } from "~/hooks/api/billing";
import { toastError } from "~/lib/plan-limit";

export default function TemplatesPage() {
  const router = useRouter();
  const { createFormFromTemplateAsync, isPending: creatingFromTemplate } =
    useCreateFormFromTemplate();
  const { createFormAsync, isPending: creatingBlank } = useCreateForm();

  const { overview } = useBillingOverview();
  const premiumUnlocked = overview?.plan.premiumTemplates ?? true; // unknown yet → let the server decide

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

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a pre-built template. Fields, structure, and design are created instantly —
              customize and publish.
            </p>
          </div>
          <span className="mt-1 text-sm whitespace-nowrap text-muted-foreground">
            {FORM_TEMPLATES.length} templates available
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_TEMPLATES.map((template) => {
            const design = getTemplateDesign(template.template);
            const visibleTags = template.fields.slice(0, 4);
            const overflow = template.fields.length - visibleTags.length;
            const busy = pendingId === template.id;
            const locked =
              !premiumUnlocked && ["DEVELOPER", "RETRO", "TICKET"].includes(template.template);

            return (
              <div
                key={template.id}
                className="glass flex flex-col rounded-2xl border border-border/60 p-5 transition hover:border-border"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex size-10 items-center justify-center rounded-xl"
                    style={{ background: `${design.accent}22`, color: design.accent }}
                  >
                    <FileStack className="size-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {["DEVELOPER", "RETRO", "TICKET"].includes(template.template) ? (
                      <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-500">
                        <Lock className="size-3" /> Premium
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className={design.badgeClass}>
                      {design.category}
                    </Badge>
                  </div>
                </div>

                <h3 className="mt-4 text-base font-semibold">{template.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {template.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {visibleTags.map((f) => (
                    <span
                      key={f.label}
                      className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {f.type.toLowerCase().replace("_", " ")}
                    </span>
                  ))}
                  {overflow > 0 ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      +{overflow}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {template.fields.length} fields
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewing(template)}>
                      <Eye className="size-3.5" /> Preview
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || creatingFromTemplate}
                      onClick={() =>
                        locked ? router.push("/dashboard/billing") : handleUseTemplate(template)
                      }
                    >
                      {busy ? "Creating..." : locked ? "Upgrade to use" : "Use Template"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Trailing Custom Form card */}
          <button
            type="button"
            onClick={handleBlankForm}
            disabled={creatingBlank}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 p-5 text-center transition hover:border-border hover:bg-muted/40"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Plus className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold">Custom Form</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from a blank canvas and build every field yourself.
              </p>
            </div>
            <span className="mt-1 text-xs font-medium text-foreground">
              {pendingId === "__blank__" ? "Creating..." : "Start Blank →"}
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
