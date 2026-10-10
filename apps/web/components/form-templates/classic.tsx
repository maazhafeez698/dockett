// apps/web/components/form-templates/classic.tsx
//
// Dockett's own respondent experience (the default for forms built from
// scratch): a punched-ticket card. One question at a time shows a huge Ember
// question, a big mono answer box, "OK ✓ / press Enter ↵" and a thin progress
// bar; all-at-once shows the same ticket with every field.

"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { LogoMark } from "~/components/logo";
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
    isFirstStep,
    isLastStep,
    onNext,
    onBack,
    onSubmit,
    submitting,
    submitted,
    errorMessage,
    isPreview,
  } = props;

  const oneAtATime = layout === "ONE_AT_A_TIME";
  const current = oneAtATime ? visibleFields[0] : undefined;
  const progress = fields.length > 0 ? ((stepIndex + (submitted ? 1 : 0.4)) / fields.length) * 100 : 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    // Enter inside an input should move forward, not submit a half-filled form.
    if (oneAtATime && !isLastStep) {
      e.preventDefault();
      onNext();
      return;
    }
    onSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target instanceof HTMLTextAreaElement) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      {/* progress */}
      {oneAtATime && !submitted ? (
        <div
          className={`${isPreview ? "absolute" : "fixed"} inset-x-0 top-0 z-20 h-1 bg-foreground/10`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={fields.length}
          aria-valuenow={stepIndex + 1}
          aria-label="Form progress"
        >
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="border border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_var(--hard-shadow)] sm:p-9">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="animate-punch flex size-14 items-center justify-center rounded-[3px] bg-primary text-primary-foreground">
              <Check className="size-7" strokeWidth={3} />
            </div>
            <p className="mono-label text-muted-foreground">Punched · {title}</p>
            <p className="font-display text-4xl leading-none font-extrabold text-primary">Thank you.</p>
            <p className="text-sm text-muted-foreground">Your response has been received.</p>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDown} noValidate>
            <p className="mono-label text-muted-foreground">
              {oneAtATime
                ? `${stepIndex + 1} → ${fields.length} · ${title}`
                : `${fields.length} ${fields.length === 1 ? "field" : "fields"} · ${title}`}
            </p>

            {oneAtATime && current ? (
              <div key={current.id} className="animate-rise mt-4">
                <h1 className="font-display text-[34px] leading-[1] font-extrabold text-primary sm:text-[44px]">
                  {current.label}
                  {current.isRequired ? <span className="ml-1 text-foreground/60">*</span> : null}
                </h1>
                {current.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{current.description}</p>
                ) : null}
                <div className="mt-6">
                  <FormFieldRenderer
                    field={current}
                    value={values[current.id] ?? ""}
                    onChange={(v) => onChange(current.id, v)}
                    isMissing={missingFieldIds.has(current.id)}
                    accent="var(--primary)"
                    fieldBackground="transparent"
                    fieldForeground="var(--foreground)"
                    variant="ticket"
                    hideLabel
                    autoFocus={!isPreview}
                  />
                </div>
              </div>
            ) : null}

            {!oneAtATime ? (
              <div className="mt-4">
                <h1 className="font-display text-[34px] leading-[1] font-extrabold text-primary sm:text-[44px]">
                  {title}
                </h1>
                {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
                <div className="mt-7 space-y-6">
                  {visibleFields.map((f) => (
                    <FormFieldRenderer
                      key={f.id}
                      field={f}
                      value={values[f.id] ?? ""}
                      onChange={(v) => onChange(f.id, v)}
                      isMissing={missingFieldIds.has(f.id)}
                      accent="var(--primary)"
                      fieldBackground="transparent"
                      fieldForeground="var(--foreground)"
                      variant="ticket-form"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div role="alert" className="mt-4 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            {missingFieldIds.size > 0 ? (
              <div role="alert" className="mt-4 text-sm text-destructive">
                {oneAtATime ? "This answer is required." : "Please fill in all required fields."}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {oneAtATime && !isLastStep ? (
                <Button type="button" onClick={onNext} size="lg">
                  OK <Check />
                </Button>
              ) : (
                <Button type="submit" size="lg" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"} {!submitting ? <Check /> : null}
                </Button>
              )}
              {oneAtATime && !isLastStep ? (
                <span className="mono-label-sm text-muted-foreground">
                  press Enter <span aria-hidden="true">↵</span>
                </span>
              ) : null}
            </div>
          </form>
        )}
      </div>

      {/* footer: step arrows + brand */}
      <div className="mt-4 flex items-center justify-between">
        {oneAtATime && !submitted ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onBack}
              disabled={isFirstStep}
              aria-label="Previous question"
              className="flex size-8 items-center justify-center border border-foreground/50 bg-card transition-colors hover:border-primary disabled:opacity-35"
            >
              <ArrowUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={isLastStep}
              aria-label="Next question"
              className="flex size-8 items-center justify-center border border-foreground/50 bg-card transition-colors hover:border-primary disabled:opacity-35"
            >
              <ArrowDown className="size-3.5" />
            </button>
          </div>
        ) : (
          <span />
        )}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="mono-label-sm flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogoMark size={12} className="text-primary" /> Powered by <b className="text-foreground">Dockett</b>
        </a>
      </div>
    </div>
  );
}
