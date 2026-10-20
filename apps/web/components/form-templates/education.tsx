// apps/web/components/form-templates/education.tsx
//
// Notebook-paper layout: a cream page with a red margin rule down the left
// and faint horizontal ruled lines, a chalkboard-green header band for the
// title. Each field sits in its own "notebook entry" rather than a plain
// stacked form.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function EducationShell(props: FormTemplateShellProps) {
  const {
    title,
    description,
    visibleFields,
    values,
    onChange,
    missingFieldIds,
    layout,
    stepIndex,
    stepCount,
    stepStartIndex,
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
  } = props;

  const design = getTemplateDesign("EDUCATION");

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-green-900/20 shadow-xl">
      <div className="bg-[#1B4332] px-6 py-8 text-center text-white sm:px-10">
        <p className="text-[11px] tracking-[0.3em] text-green-200 uppercase">Class Form</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-2 text-sm text-green-100/80">{description}</p> : null}
      </div>

      <div
        className="relative bg-[#FFFDF6] px-8 py-8 sm:px-12"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 34px, rgba(27,67,50,0.08) 35px)",
        }}
      >
        <div className="pointer-events-none absolute top-0 bottom-0 left-6 w-px bg-red-300/60 sm:left-9" />

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-green-700" />
            <p className="text-lg font-medium text-green-900">Submitted — thanks!</p>
          </div>
        ) : (
          <form
            data-submission-form
            onSubmit={onSubmit}
            noValidate
            className="space-y-7 pl-4 sm:pl-6"
          >
            {stepCount > 1 ? (
              <p className="font-serif text-xs text-green-800/70 italic">
                {layout === "ONE_AT_A_TIME" ? "Question" : "Page"} {stepIndex + 1} of {stepCount}
              </p>
            ) : null}

            {visibleFields.map((f, i) => (
              <div key={f.id} className="space-y-1.5">
                <p className="font-serif text-xs text-green-800/60 italic">
                  {stepStartIndex + i + 1}.
                </p>
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

            {errorMessage ? <div className="text-sm text-red-700">{errorMessage}</div> : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-red-700">Please fill in all required fields.</div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={onBack}>
                  Back
                </Button>
              ) : null}
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  className="rounded-full bg-[#1B4332] px-6 hover:bg-[#153a29]"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  className="text-white rounded-full bg-[#1B4332] px-6 hover:bg-[#153a29]"
                >
                  {submitting ? "Submitting..." : "Turn In"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
