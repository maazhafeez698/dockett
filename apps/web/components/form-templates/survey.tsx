// apps/web/components/form-templates/survey.tsx
//
// A single big question centered on the screen with progress dots up top
// — deliberately minimal chrome so the question itself is the whole
// layout. Works best with ONE_AT_A_TIME (its default), but still renders
// sensibly stacked for ALL_AT_ONCE.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function SurveyShell(props: FormTemplateShellProps) {
  const {
    title,
    description,
    visibleFields,
    values,
    onChange,
    missingFieldIds,
    stepIndex,
    stepCount,
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
  } = props;

  const design = getTemplateDesign("SURVEY");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-xs font-medium tracking-[0.25em] text-teal-500 uppercase">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}

      {stepCount > 1 ? (
        <div
          className="mt-6 flex items-center gap-1.5"
          role="status"
          aria-label={`Page ${stepIndex + 1} of ${stepCount}`}
        >
          <span className="sr-only">
            Page {stepIndex + 1} of {stepCount}
          </span>
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === stepIndex ? 24 : 8,
                background: i <= stepIndex ? design.accent : "var(--muted)",
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-10 w-full">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <CheckCircle2 className="size-12" style={{ color: design.accent }} />
            <p className="text-xl font-semibold">Thanks for your feedback!</p>
          </div>
        ) : (
          <form data-submission-form onSubmit={onSubmit} noValidate className="w-full space-y-10">
            <div className="space-y-8">
              {visibleFields.map((f) => (
                <div key={f.id} className="text-left">
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
            </div>

            {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-destructive">This one's required.</div>
            ) : null}

            <div className="flex items-center justify-center gap-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Back
                </button>
              ) : null}
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  style={{ background: design.accent, color: "#04211d" }}
                  className="rounded-full border-0 px-8 hover:opacity-90"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ background: design.accent, color: "#04211d" }}
                  className="rounded-full border-0 px-8 hover:opacity-90"
                >
                  {submitting ? "Sending..." : "Submit"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
