"use client";

import { Bug, CheckCircle2, CircleDot, Code2, FileCode2, GitBranch, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function DeveloperShell(props: FormTemplateShellProps) {
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

  const design = getTemplateDesign("DEVELOPER", props.designSettings);

  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-[#303844] bg-[#0B1017] font-mono text-[#D7E0EA] shadow-[0_28px_90px_-38px_rgba(0,0,0,.9)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#252D38] bg-[#111923] px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-yellow-500/70" />
        <span className="size-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 flex items-center gap-2 border border-[#303844] border-b-[#0B1017] bg-[#0B1017] px-3 py-2 text-[11px] text-[#D7E0EA]">
          <Bug className="size-3.5 text-[#FB7185]" /> bug-report.md <span className="text-[#778394]">×</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#8291A3]"><CircleDot className="size-3 text-[#A3E635]" /> NEW ISSUE</span>
      </div>

      <div className="grid sm:grid-cols-[minmax(0,1fr)_190px]">
      <div className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] text-[#8291A3]">
          <span className="flex items-center gap-1.5 rounded border border-[#2A3542] bg-[#141C26] px-2 py-1"><Code2 className="size-3 text-[#7DD3FC]" /> ISSUE TRACKER</span>
          <span className="flex items-center gap-1.5 rounded border border-[#2A3542] bg-[#141C26] px-2 py-1"><ShieldCheck className="size-3 text-[#A3E635]" /> PRIVATE REPORT</span>
          <span className="ml-auto">{stepCount > 1 ? `STEP ${String(stepIndex + 1).padStart(2, "0")} / ${String(stepCount).padStart(2, "0")}` : "INTAKE"}</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F2F6FA]">{title || "Report a bug"}</h1>
        {description ? <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-[#9AA8B8]">{description}</p> : null}

        {submitted ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-400" />
            <p className="text-sm text-emerald-300">// report created - thank you for the clear details</p>
          </div>
        ) : (
          <form data-submission-form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
            {stepCount > 1 ? (
              <p className="text-xs text-[#8291A3]">
                {layout === "ONE_AT_A_TIME"
                  ? `[${stepIndex + 1}/${stepCount}]`
                  : `[page ${stepIndex + 1}/${stepCount}]`}
              </p>
            ) : null}

            {visibleFields.map((f) => (
              <div key={f.id} className="relative rounded-md border border-[#2A3542] bg-[#111923] p-3.5 pl-12 before:absolute before:top-0 before:bottom-0 before:left-9 before:border-l before:border-[#26313D] before:content-['']">
                <span className="absolute top-4 left-3 text-[10px] tabular-nums text-[#647386]">{String(stepStartIndex + 1).padStart(2, "0")}</span>
                <p className="mb-2 text-xs text-[#8FB4D8]">
                  <span className="text-[#647386]">›</span> {f.label}
                  {f.isRequired ? <span className="ml-1 text-[#FB7185]">required</span> : null}
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
              <div className="text-sm text-[#FB7185]">// error: {errorMessage}</div>
            ) : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-[#FB7185]">// validation: complete the required fields above</div>
            ) : null}

            <div className="flex gap-2 pt-1">
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border-[#354252] bg-transparent text-[#C2CEDB] hover:bg-[#1D2834]"
                >
                  back
                </Button>
              ) : null}
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  style={{ background: design.accent, color: design.accentForeground }}
                  className="border-0 hover:opacity-90"
                >
                  Continue <span aria-hidden="true">→</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ background: design.accent, color: design.accentForeground }}
                  className="border-0 hover:opacity-90"
                >
                  {submitting ? "Creating report…" : "Submit bug report"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
      <aside className="hidden border-l border-[#252D38] bg-[#0E151D] p-4 sm:block">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-wider text-[#8796A8]"><GitBranch className="size-3.5" /> REPORT GUIDE</p>
        <div className="space-y-3 text-[11px] leading-relaxed text-[#9AA8B8]">
          <p><b className="text-[#D7E0EA]">1 · Describe</b><br />What did you expect to happen?</p>
          <p><b className="text-[#D7E0EA]">2 · Reproduce</b><br />Add steps another person can follow.</p>
          <p><b className="text-[#D7E0EA]">3 · Attach</b><br />Include a screenshot or relevant details if requested.</p>
        </div>
        <div className="mt-5 border-t border-[#252D38] pt-3 text-[10px] text-[#738297]">Please avoid including passwords or private keys.</div>
      </aside>
      </div>
    </div>
  );
}
