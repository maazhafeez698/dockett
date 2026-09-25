// apps/web/components/form-templates/developer.tsx
//
// A dark terminal window (traffic-light dots, monospace throughout).
// Field labels render like a CLI prompt (`$ field_name`) and inputs sit in
// a bordered "code block" rather than a normal form control style.

"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function DeveloperShell(props: FormTemplateShellProps) {
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

  const design = getTemplateDesign("DEVELOPER");

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-emerald-900/50 bg-[#0A0F0A] font-mono text-emerald-200 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-emerald-900/50 bg-[#0F1710] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-yellow-500/70" />
        <span className="size-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 truncate text-xs text-emerald-500/70">
          ~/forms/{title.toLowerCase().replace(/\s+/g, "-") || "untitled"}.sh
        </span>
      </div>

      <div className="p-5 sm:p-7">
        <p className="text-emerald-500">
          <span className="text-emerald-600">$</span> ./run --form
          <span className="text-emerald-100"> "{title}"</span>
        </p>
        {description ? <p className="mt-1 text-xs text-emerald-500/70"># {description}</p> : null}

        {submitted ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-400" />
            <p className="text-sm text-emerald-300">// submission received — exit code 0</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
            {layout === "ONE_AT_A_TIME" && fields.length > 1 ? (
              <p className="text-xs text-emerald-600">
                [{stepIndex + 1}/{fields.length}]
              </p>
            ) : null}

            {visibleFields.map((f) => (
              <div key={f.id} className="rounded border border-emerald-900/50 bg-black/40 p-3.5">
                <p className="mb-2 text-xs text-emerald-500">
                  <span className="text-emerald-700">$</span> {f.label}
                  {f.isRequired ? <span className="ml-1 text-red-400">*required</span> : null}
                </p>
                <div className="[&_label]:hidden">
                  <FormFieldRenderer
                    field={{ ...f, label: "" }}
                    value={values[f.id] ?? ""}
                    onChange={(v) => onChange(f.id, v)}
                    isMissing={missingFieldIds.has(f.id)}
                    accent={design.accent}
                    fieldBackground={design.fieldBackground}
                    fieldForeground={design.fieldForeground}
                  />
                </div>
              </div>
            ))}

            {errorMessage ? (
              <div className="text-sm text-red-400"># error: {errorMessage}</div>
            ) : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-red-400"># error: required fields missing</div>
            ) : null}

            <div className="flex gap-2 pt-1">
              {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border-emerald-800 bg-transparent text-emerald-300 hover:bg-emerald-950"
                >
                  back
                </Button>
              ) : null}
              {layout === "ONE_AT_A_TIME" && !isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  className="border-0 bg-emerald-500 text-black hover:bg-emerald-400"
                >
                  next &gt;
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  className="border-0 bg-emerald-500 text-black hover:bg-emerald-400"
                >
                  {submitting ? "submitting..." : "$ submit"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
