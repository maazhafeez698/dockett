"use client";

import { CheckCircle2, CircleHelp, ClipboardList, LockKeyhole, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

export function TicketShell(props: FormTemplateShellProps) {
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
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
  } = props;

  const design = getTemplateDesign("TICKET", props.designSettings);

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#D7DFEA] bg-[#F3F6FA] text-[#172335] shadow-[0_26px_75px_-42px_rgba(15,35,65,.55)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#293B58] bg-[#172844] px-5 py-4 text-white sm:px-7">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white/10"><Wrench className="size-4" /></div>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold tracking-[.18em] text-blue-200/80 uppercase">IT service desk</p><p className="mt-0.5 truncate text-sm font-semibold">{title || "New support request"}</p></div>
        <span className="rounded-full border border-blue-200/25 bg-blue-300/10 px-3 py-1 font-mono text-[10px] tracking-wide text-blue-100">NEW REQUEST</span>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_230px]">
      <div className="p-5 sm:p-7">
        {description ? <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[#627188]">{description}</p> : null}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] text-[#66768D]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E0EA] bg-white px-2.5 py-1"><LockKeyhole className="size-3" /> Private to the support team</span>
          {stepCount > 1 ? <span className="ml-auto font-mono">STEP {stepIndex + 1} OF {stepCount}</span> : null}
        </div>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-10 text-center">
            <CheckCircle2 className="size-9 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-950">Request submitted</p>
            <p className="text-xs text-emerald-800">The support team has received your details.</p>
          </div>
        ) : (
          <form data-submission-form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            {stepCount > 1 ? (
              <p className="font-mono text-[11px] text-[#65768E]">
                {layout === "ONE_AT_A_TIME"
                  ? `field ${stepIndex + 1}/${stepCount}`
                  : `page ${stepIndex + 1}/${stepCount}`}
              </p>
            ) : null}

            {visibleFields.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-[#D8E0EA] bg-white p-4 shadow-[0_2px_5px_rgba(25,45,75,.035)] [&_label]:text-[11px] [&_label]:font-semibold [&_label]:tracking-wide [&_label]:text-[#52647C] [&_label]:uppercase"
              >
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

            {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div> : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-red-700">Complete the required fields to submit.</div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border-[#CBD5E1] bg-white text-[#34445A] hover:bg-[#E9EFF6]"
                >
                  Back
                </Button>
              ) : null}
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  style={{ background: design.accent, color: design.accentForeground }}
                  className="border-0 text-white hover:opacity-90"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ background: design.accent, color: design.accentForeground }}
                  className="border-0 text-white hover:opacity-90"
                >
                  {submitting ? "Submitting…" : "Submit support request"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
      <aside className="border-t border-[#DCE3EC] bg-[#EAF0F7] p-5 lg:border-t-0 lg:border-l lg:p-6">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#263B58]"><ClipboardList className="size-4" /> What happens next</p>
        <ol className="mt-4 space-y-4 text-xs leading-relaxed text-[#617188]">
          <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#315B91]">1</span><span><b className="text-[#263B58]">Review</b><br />The team reviews the details and impact.</span></li>
          <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#315B91]">2</span><span><b className="text-[#263B58]">Triage</b><br />Your request is routed to the right person.</span></li>
          <li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#315B91]">3</span><span><b className="text-[#263B58]">Follow up</b><br />Include a reachable email so support can reply.</span></li>
        </ol>
        <div className="mt-5 rounded-lg border border-[#D8E0EA] bg-white p-3 text-[11px] leading-relaxed text-[#617188]"><CircleHelp className="mr-1 inline size-3.5 text-[#315B91]" /> Add device, software version, and steps to reproduce when relevant.</div>
        <p className="mt-4 flex items-center gap-1.5 text-[10px] text-[#77869B]"><ShieldCheck className="size-3.5" /> Don’t include passwords or access tokens.</p>
      </aside>
      </div>
    </div>
  );
}
