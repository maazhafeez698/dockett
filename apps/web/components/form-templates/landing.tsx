// apps/web/components/form-templates/landing.tsx
//
// A bold marketing-landing-page hero (huge headline, gradient backdrop,
// feature bullets) sits above a short, funnel-style field area — the
// field list is presented like a signup widget bolted onto a landing
// page, not a form page in its own right.

"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getTemplateDesign } from "~/lib/template-designs";
import type { FormTemplateShellProps } from "./types";

const BULLETS = ["Early access before public launch", "Priority onboarding", "Shape the roadmap"];

export function LandingShell(props: FormTemplateShellProps) {
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

  const design = getTemplateDesign("LANDING");
  const [from, to] = design.accentGradient;

  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-3xl shadow-2xl">
      <div
        className="px-6 py-14 text-center text-white sm:px-12"
        style={{ background: `radial-gradient(circle at top, ${to}33, ${from})` }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5" /> Now taking sign-ups
        </span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mx-auto mt-3 max-w-sm text-white/80">{description}</p> : null}

        <ul className="mx-auto mt-6 flex max-w-xs flex-col gap-1.5 text-left text-sm text-white/80">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-white/70" /> {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-[#12071A] px-6 py-8 sm:px-10">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="size-10" style={{ color: design.accent }} />
            <p className="text-lg font-semibold text-white">You're on the list!</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {layout === "ONE_AT_A_TIME" && fields.length > 1 ? (
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${((stepIndex + 1) / fields.length) * 100}%`,
                    background: design.accent,
                  }}
                />
              </div>
            ) : null}

            {visibleFields.map((f) => (
              <div key={f.id} className="[&_label]:text-white [&_p]:text-white/60">
                <FormFieldRenderer
                  field={f}
                  value={values[f.id] ?? ""}
                  onChange={(v) => onChange(f.id, v)}
                  isMissing={missingFieldIds.has(f.id)}
                  accent={design.accent}
                />
              </div>
            ))}

            {errorMessage ? <div className="text-sm text-red-300">{errorMessage}</div> : null}
            {missingFieldIds.size > 0 ? (
              <div className="text-sm text-red-300">Please fill in all required fields.</div>
            ) : null}

            <div className="flex gap-2 pt-1">
              {layout === "ONE_AT_A_TIME" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  Back
                </Button>
              ) : null}
              {layout === "ONE_AT_A_TIME" && !isLastStep ? (
                <Button
                  type="button"
                  onClick={onNext}
                  style={{ background: design.accent }}
                  className="flex-1 border-0 text-[#2A0A38] hover:opacity-90"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{ background: design.accent }}
                  className="flex-1 border-0 text-[#2A0A38] hover:opacity-90"
                >
                  {submitting ? "Joining..." : "Join the waitlist"}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
