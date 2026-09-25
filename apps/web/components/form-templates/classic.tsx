// apps/web/components/form-templates/classic.tsx
//
// The plain Formless look (glass card over a gradient band) — default for
// forms built from scratch ("Custom Form"). Not offered in the template
// gallery; this is what "no template" looks like, kept intentionally in
// the existing product design language rather than a bespoke skin.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function ClassicShell(props: FormTemplateShellProps) {
  const {
    title,
    description,
    fields,
    visibleFields,
    values,
    onChange,
    missingFieldIds,
    layout,
    stepIndex,
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
  } = props;

  const design = getTemplateDesign("CLASSIC");
  const [from, to] = design.accentGradient;

  return (
    <div className="mx-auto max-w-2xl">
      <div
        className="rounded-3xl px-6 py-10 sm:px-8"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, color: "#F5F5FF" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 opacity-80">{description}</p> : null}
        {layout === "ONE_AT_A_TIME" && fields.length > 0 ? (
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${((stepIndex + 1) / fields.length) * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-5 px-0 pb-10">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-10" style={{ color: design.accent }} />
              <p className="text-lg font-medium">Thank you.</p>
              <p className="text-sm text-muted-foreground">Your submission has been received.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-7">
              {visibleFields.map((f) => (
                <FormFieldRenderer
                  key={f.id}
                  field={f}
                  value={values[f.id] ?? ""}
                  onChange={(v) => onChange(f.id, v)}
                  isMissing={missingFieldIds.has(f.id)}
                  accent={design.accent}
                  fieldBackground={design.fieldBackground}
                  fieldForeground={design.fieldForeground}
                />
              ))}

              {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}
              {missingFieldIds.size > 0 ? (
                <div className="text-sm text-destructive">Please fill in all required fields.</div>
              ) : null}

              <div className="flex gap-2">
                {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                  <Button type="button" variant="outline" onClick={onBack} className="flex-1">
                    Back
                  </Button>
                ) : null}
                {layout === "ONE_AT_A_TIME" && !isLastStep ? (
                  <Button
                    type="button"
                    onClick={onNext}
                    style={{ background: design.accent, color: "#fff" }}
                    className="flex-1 border-0 hover:opacity-90"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitting}
                    style={{ background: design.accent, color: "#fff" }}
                    className="flex-1 border-0 hover:opacity-90"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
