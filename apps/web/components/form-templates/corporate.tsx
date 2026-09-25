// apps/web/components/form-templates/corporate.tsx
//
// Formal two-column layout: a fixed left rail with the form's title, a
// numbered outline of every field, and a step indicator; the right column
// holds the actual inputs on a plain white/near-white card. Serif display
// type for headings, sans for body — a deliberately "HR department" feel.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function CorporateShell(props: FormTemplateShellProps) {
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

  const design = getTemplateDesign("CORPORATE");
  const visibleIds = new Set(visibleFields.map((f) => f.id));

  return (
    <div className="mx-auto grid max-w-4xl gap-0 overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-950 shadow-2xl sm:grid-cols-[280px_1fr]">
      {/* Left rail */}
      <aside className="bg-slate-900 p-8 text-slate-200">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
          Application Form
        </p>
        <h1 className="mt-2 font-serif text-2xl leading-snug font-semibold text-white">{title}</h1>
        {description ? <p className="mt-3 text-sm text-slate-400">{description}</p> : null}

        <ol className="mt-8 space-y-3 border-t border-slate-700/60 pt-6">
          {fields.map((f, i) => {
            const active = visibleIds.has(f.id);
            const done = layout === "ONE_AT_A_TIME" ? i < stepIndex : false;
            return (
              <li key={f.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                    active
                      ? "border-slate-200 bg-slate-200 text-slate-900"
                      : done
                        ? "border-slate-500 bg-slate-700 text-slate-300"
                        : "border-slate-700 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={active ? "text-white" : "text-slate-500"}>{f.label}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Content */}
      <div className="bg-slate-50 p-8 text-slate-900 sm:p-10">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 className="size-10 text-slate-700" />
            <p className="text-lg font-medium">Application received.</p>
            <p className="text-sm text-slate-500">We'll be in touch.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-7">
            {visibleFields.map((f) => (
              <div key={f.id} className="border-b border-slate-200 pb-6 last:border-0">
                <FormFieldRenderer
                  field={f}
                  value={values[f.id] ?? ""}
                  onChange={(v) => onChange(f.id, v)}
                  isMissing={missingFieldIds.has(f.id)}
                  accent={design.accent}
                  fieldBackground={design.fieldBackground}
                  fieldForeground={design.fieldForeground}
                />
              </div>
            ))}

            {errorMessage ? <div className="text-sm text-red-600">{errorMessage}</div> : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-red-600">Please complete all required fields.</div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={onBack}>
                  Back
                </Button>
              ) : null}
              {layout === "ONE_AT_A_TIME" && !isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  className="rounded-none bg-slate-900 px-8 hover:bg-slate-800"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  className="text-white rounded-full bg-slate-900 px-8 hover:bg-slate-800"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
