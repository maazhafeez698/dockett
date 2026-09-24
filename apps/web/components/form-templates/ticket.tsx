// apps/web/components/form-templates/ticket.tsx
//
// Kanban-ticket card styling: a ticket-ID header badge, a colored status
// rail down the left edge, and each field presented as a labeled "ticket
// field" row rather than a plain stacked form — reads like an internal
// ops/support tool, not a survey.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function TicketShell(props: FormTemplateShellProps) {
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

  const design = getTemplateDesign("TICKET");

  return (
    <div className="mx-auto flex max-w-2xl overflow-hidden rounded-xl border border-orange-900/20 bg-[#161311] shadow-2xl">
      <div className="w-1.5 shrink-0" style={{ background: design.accent }} />

      <div className="flex-1 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="rounded bg-orange-500/15 px-2 py-1 font-mono text-[11px] font-semibold text-orange-300">
            TICKET-NEW
          </span>
          <span className="font-mono text-[11px] text-neutral-500">status: open</span>
        </div>

        <h1 className="mt-3 text-xl font-semibold text-neutral-100">{title}</h1>
        {description ? <p className="mt-1 text-sm text-neutral-400">{description}</p> : null}

        {submitted ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-orange-900/30 bg-black/30 py-10 text-center">
            <CheckCircle2 className="size-9 text-orange-400" />
            <p className="text-sm text-neutral-200">Ticket filed. We'll route it shortly.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            {layout === "ONE_AT_A_TIME" && fields.length > 1 ? (
              <p className="font-mono text-[11px] text-orange-400/80">
                field {stepIndex + 1}/{fields.length}
              </p>
            ) : null}

            {visibleFields.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-neutral-800 bg-[#1E1A17] p-4 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:tracking-wide [&_label]:text-neutral-400 [&_label]:uppercase"
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

            {errorMessage ? <div className="text-sm text-red-400">{errorMessage}</div> : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-red-400">Required fields missing.</div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border-neutral-700 bg-transparent text-neutral-300 hover:bg-neutral-800"
                >
                  Back
                </Button>
              ) : null}
              {layout === "ONE_AT_A_TIME" && !isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  style={{ background: design.accent }}
                  className="border-0 text-black hover:opacity-90"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ background: design.accent }}
                  className="border-0 text-black hover:opacity-90"
                >
                  {submitting ? "Filing..." : "File Ticket"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
