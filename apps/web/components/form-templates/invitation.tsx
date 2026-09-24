// apps/web/components/form-templates/invitation.tsx
//
// Symmetric, cream-and-gold formal invitation layout: centered serif
// display headline, thin gold rule lines above/below, generous whitespace.
// The opposite of a "form" feel — reads like a printed RSVP card.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function InvitationShell(props: FormTemplateShellProps) {
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

  const design = getTemplateDesign("INVITATION");

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-amber-300/50 bg-[#FBF6EC] px-6 py-12 text-center shadow-xl sm:px-14">
      <div className="mx-auto h-px w-16" style={{ background: design.accent }} />
      <p className="mt-4 text-[11px] tracking-[0.35em] text-amber-800/70 uppercase">
        You're Invited
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-[#3B2A12]">{title}</h1>
      {description ? (
        <p className="mx-auto mt-3 max-w-sm font-serif text-sm text-[#6B5636] italic">
          {description}
        </p>
      ) : null}
      <div className="mx-auto mt-5 h-px w-16" style={{ background: design.accent }} />

      <div className="mt-10 text-left">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="size-10" style={{ color: design.accent }} />
            <p className="font-serif text-lg text-[#3B2A12]">We look forward to seeing you.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            {layout === "ONE_AT_A_TIME" && fields.length > 1 ? (
              <p className="text-center font-serif text-xs text-amber-800/60 italic">
                {stepIndex + 1} of {fields.length}
              </p>
            ) : null}

            {visibleFields.map((f) => (
              <div
                key={f.id}
                className="[&_label]:font-serif [&_label]:text-[#3B2A12] [&_input]:rounded-none [&_input]:border-0 [&_input]:border-b [&_input]:border-amber-300 [&_input]:bg-transparent [&_input]:px-0 [&_input]:focus-visible:ring-0 [&_textarea]:rounded-none [&_textarea]:border-amber-300 [&_textarea]:bg-transparent"
              >
                <FormFieldRenderer
                  field={f}
                  value={values[f.id] ?? ""}
                  onChange={(v) => onChange(f.id, v)}
                  isMissing={missingFieldIds.has(f.id)}
                  accent={design.accent}
                />
              </div>
            ))}

            {errorMessage ? (
              <div className="text-center text-sm text-red-700">{errorMessage}</div>
            ) : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-center text-sm text-red-700">
                Please complete all required fields.
              </div>
            ) : null}

            <div className="flex justify-center gap-3 pt-4">
              {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="rounded-none border-amber-400 text-[#3B2A12] hover:bg-amber-50"
                >
                  Back
                </Button>
              ) : null}
              {layout === "ONE_AT_A_TIME" && !isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  style={{ background: design.accent }}
                  className="rounded-none border-0 px-8 text-[#3B2A12] hover:opacity-90"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ background: design.accent }}
                  className="rounded-none border-0 px-8 text-[#3B2A12] hover:opacity-90"
                >
                  {submitting ? "Sending..." : "Send RSVP"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
