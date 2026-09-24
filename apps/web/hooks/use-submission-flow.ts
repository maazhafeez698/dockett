// apps/web/hooks/use-submission-flow.ts
//
// Owns all field-pacing state (current step, values, which fields are
// missing) independent of which template shell is rendering. Shared by the
// public fill page and the builder's live preview so "one field at a time
// vs. all at once" behaves identically everywhere it's used.

"use client";

import { useMemo, useState } from "react";
import type { RendererField } from "~/components/form-field-renderer";

export type SubmissionLayout = "ONE_AT_A_TIME" | "ALL_AT_ONCE";

export function useSubmissionFlow(fields: RendererField[], layout: SubmissionLayout) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missingFieldIds, setMissingFieldIds] = useState<Set<string>>(new Set());

  const visibleFields = useMemo(() => {
    if (layout === "ALL_AT_ONCE") return fields;
    const current = fields[Math.min(step, Math.max(fields.length - 1, 0))];
    return current ? [current] : [];
  }, [fields, layout, step]);

  const isFirstStep = step === 0;
  const isLastStep = layout === "ALL_AT_ONCE" ? true : step >= fields.length - 1;

  function onChange(fieldId: string, value: string) {
    setValues((v) => ({ ...v, [fieldId]: value }));
    setMissingFieldIds((s) => {
      if (!s.has(fieldId)) return s;
      const next = new Set(s);
      next.delete(fieldId);
      return next;
    });
  }

  function validate(fieldsToCheck: RendererField[]): boolean {
    const missing = new Set<string>();
    for (const f of fieldsToCheck) {
      if (f.isRequired && !(values[f.id] ?? "").trim()) missing.add(f.id);
    }
    setMissingFieldIds(missing);
    return missing.size === 0;
  }

  function onNext() {
    if (!validate(visibleFields)) return;
    setStep((s) => Math.min(s + 1, Math.max(fields.length - 1, 0)));
  }

  function onBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function validateAll(): boolean {
    return validate(fields);
  }

  function toSubmissionValues() {
    return fields.map((f) => ({ fieldId: f.id, value: values[f.id] ?? "" }));
  }

  return {
    step,
    setStep,
    values,
    setValues,
    missingFieldIds,
    visibleFields,
    isFirstStep,
    isLastStep,
    onChange,
    onNext,
    onBack,
    validateAll,
    toSubmissionValues,
  };
}
