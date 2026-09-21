// apps/web/app/dashboard/templates/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { trpc } from "~/trpc/client";
import { FORM_TEMPLATES, type FormTemplate } from "~/lib/templates-data";
import { getFormTheme } from "~/lib/form-themes";

const CATEGORIES = ["All", ...Array.from(new Set(FORM_TEMPLATES.map((t) => t.category)))];

export default function TemplatesPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("All");
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const { mutateAsync: createFormAsync } = trpc.form.createForm.useMutation();
  const { mutateAsync: updateFormAsync } = trpc.form.updateForm.useMutation();
  const { mutateAsync: createFieldAsync } = trpc.formField.createField.useMutation();

  const visibleTemplates =
    activeCategory === "All"
      ? FORM_TEMPLATES
      : FORM_TEMPLATES.filter((t) => t.category === activeCategory);

  const handleUseTemplate = async (template: FormTemplate) => {
    setCreatingId(template.id);
    try {
      const form = await createFormAsync({ title: template.name });
      await updateFormAsync({ formId: form.id, theme: template.theme });

      // Sequential, not Promise.all — field ordering is derived from
      // creation order server-side, so these need to land in order.
      for (const field of template.fields) {
        await createFieldAsync({
          formId: form.id,
          label: field.label,
          type: field.type,
          isRequired: field.isRequired ?? false,
          placeholder: field.placeholder,
          description: field.description,
          config: field.config,
        });
      }

      router.push(`/dashboard/forms/${form.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create form from template");
      setCreatingId(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Form Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a real, structured template — each one has its own fields, not just a
            recolored layout.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleTemplates.map((t) => {
            const theme = getFormTheme(t.theme);
            const isCreating = creatingId === t.id;

            return (
              <div key={t.id} className="glass overflow-hidden rounded-2xl">
                <div
                  className="p-4"
                  style={{
                    background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                    color: theme.onGradient,
                  }}
                >
                  <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                    {t.category}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold">{t.name}</h3>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.fields.length} fields</p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleUseTemplate(t)}
                    disabled={isCreating}
                  >
                    {isCreating ? "Creating..." : "Use this template"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
