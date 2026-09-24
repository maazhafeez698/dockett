// apps/web/components/template-preview-dialog.tsx
//
// "Preview" popup on a gallery card — shows the complete form experience
// using the same shell component the real public page uses, filled with
// sample values so it doesn't read as an empty shell. Rendered in the
// template's own default submissionLayout so the pacing is representative
// too. Non-interactive in the sense that nothing here ever calls the
// server (isPreview just suppresses that, not the click-through itself).

"use client";

import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { FormTemplateRenderer } from "~/components/form-templates";
import type { FormTemplate } from "~/lib/templates-data";
import type { RendererField } from "~/components/form-field-renderer";

const SAMPLE_BY_TYPE: Record<string, string> = {
  TEXT: "Jordan Lee",
  EMAIL: "jordan@example.com",
  NUMBER: "3",
  LONG_TEXT: "This is a sample answer showing roughly how much room there is to respond.",
  YES_NO: "true",
  DATE: "2026-10-04",
  RATING: "4",
};

function toRendererFields(template: FormTemplate): RendererField[] {
  return template.fields.map((f, i) => ({
    id: `preview-${i}`,
    label: f.label,
    description: f.description ?? null,
    placeholder: f.placeholder ?? null,
    isRequired: f.isRequired ?? false,
    type: f.type,
    config: f.config ?? null,
  }));
}

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onUseTemplate,
}: {
  template: FormTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (template: FormTemplate) => void;
}) {
  if (!template) return null;

  const fields = toRendererFields(template);
  const sampleValues: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "DROPDOWN" || f.type === "MULTI_SELECT" || f.type === "CHECKBOX_GROUP") {
      const opts = (f.config as { options?: string[] } | null)?.options;
      if (opts?.length) sampleValues[f.id] = opts[0]!;
    } else {
      sampleValues[f.id] = SAMPLE_BY_TYPE[f.type] ?? "Sample answer";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle className="sr-only">{template.name} preview</DialogTitle>

        <div className="pointer-events-none py-2">
          <FormTemplateRenderer
            template={template.template}
            title={template.name}
            description={template.description}
            fields={fields}
            visibleFields={fields}
            values={sampleValues}
            onChange={() => {}}
            missingFieldIds={new Set()}
            layout="ALL_AT_ONCE"
            stepIndex={0}
            isFirstStep
            isLastStep
            onNext={() => {}}
            onBack={() => {}}
            onSubmit={(e) => e.preventDefault()}
            submitting={false}
            submitted={false}
            isPreview
          />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onUseTemplate(template)}>Use this template</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
