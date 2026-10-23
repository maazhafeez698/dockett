// One deterministic path engine powers builder preview, public navigation, progress, and validation.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RendererField } from "~/components/form-field-renderer";
import { isUploading } from "~/lib/file-answer";
import { numberProblem, type NumberRules } from "~/lib/field-rules";
import { ALL_AT_ONCE_PAGE_SIZE } from "@repo/services/form-field/limits";
import { calculateActivePath } from "@repo/services/form-logic";

export type SubmissionLayout = "ONE_AT_A_TIME" | "ALL_AT_ONCE";

export function useSubmissionFlow(fields: RendererField[], layout: SubmissionLayout, resumeKey?: string) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missingFieldIds, setMissingFieldIds] = useState<Set<string>>(new Set());
  const [isRestoring, setIsRestoring] = useState(!!resumeKey);
  const [resumeDisabled, setResumeDisabled] = useState(false);
  const fieldIdsKey = fields.map((field) => field.id).join(",");
  const previousLayout = useRef(layout);

  useEffect(() => {
    if (!resumeKey) {
      setIsRestoring(false);
      return;
    }
    setIsRestoring(true);
    try {
      const saved = sessionStorage.getItem(resumeKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { values?: Record<string, string>; step?: number };
        const known = new Set(fields.map((field) => field.id));
        const restoredValues = Object.fromEntries(
          Object.entries(parsed.values ?? {}).filter(([fieldId, value]) => known.has(fieldId) && typeof value === "string"),
        );
        const restoredPath = calculateActivePath(fields, restoredValues);
        setValues(Object.fromEntries(Object.entries(restoredValues).filter(([fieldId]) => restoredPath.includes(fieldId))));
        setStep(Number.isInteger(parsed.step) && parsed.step! >= 0 ? parsed.step! : 0);
      } else {
        setValues({});
        setStep(0);
      }
    } catch {
      setValues({});
      setStep(0);
    } finally {
      setResumeDisabled(false);
      setIsRestoring(false);
    }
  // fieldIdsKey captures the identity of the current form version without reacting to field object churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeKey, fieldIdsKey]);

  useEffect(() => {
    if (!resumeKey || isRestoring || resumeDisabled) return;
    try {
      sessionStorage.setItem(resumeKey, JSON.stringify({ values, step }));
    } catch {
      // Browsers with disabled storage still allow the respondent to complete the form in memory.
    }
  }, [isRestoring, resumeDisabled, resumeKey, step, values]);

  const activePath = useMemo(() => calculateActivePath(fields, values), [fields, values]);
  const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const activeFields = useMemo(
    () => activePath.map((fieldId) => fieldsById.get(fieldId)).filter((field): field is RendererField => !!field),
    [activePath, fieldsById],
  );
  const pageSize = layout === "ONE_AT_A_TIME" ? 1 : ALL_AT_ONCE_PAGE_SIZE;
  const stepCount = Math.ceil(activeFields.length / pageSize);
  const currentStep = Math.min(step, Math.max(stepCount - 1, 0));

  useEffect(() => {
    if (previousLayout.current === layout) return;
    previousLayout.current = layout;
    setStep(0);
  }, [layout]);

  const visibleFields = useMemo(() => {
    const start = currentStep * pageSize;
    return activeFields.slice(start, start + pageSize);
  }, [activeFields, currentStep, pageSize]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep >= stepCount - 1;
  const previousStep = useRef(currentStep);

  useEffect(() => {
    if (previousStep.current === currentStep) return;
    previousStep.current = currentStep;
    const form = document.querySelector<HTMLFormElement>("[data-submission-form]");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstField = form?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button',
    );
    firstField?.focus({ preventScroll: true });
  }, [currentStep]);

  function onChange(fieldId: string, value: string) {
    setValues((current) => {
      const changed = { ...current, [fieldId]: value };
      const path = new Set(calculateActivePath(fields, changed));
      return Object.fromEntries(Object.entries(changed).filter(([id]) => path.has(id)));
    });
    setMissingFieldIds((current) => {
      const next = new Set(current);
      next.delete(fieldId);
      return next;
    });
  }

  function validate(fieldsToCheck: RendererField[]): boolean {
    const missing = new Set<string>();
    for (const field of fieldsToCheck) {
      const value = values[field.id] ?? "";
      if (field.type === "FILE_UPLOAD") {
        if (isUploading(value) || (field.isRequired && !value.trim())) missing.add(field.id);
        continue;
      }
      if (field.isRequired && !value.trim()) missing.add(field.id);
      else if (field.type === "NUMBER" && numberProblem(value, (field.config ?? {}) as NumberRules)) {
        missing.add(field.id);
      }
    }
    setMissingFieldIds(missing);
    return missing.size === 0;
  }

  function onNext(event?: React.MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    if (!validate(visibleFields)) return;
    setStep((current) => Math.min(current + 1, Math.max(stepCount - 1, 0)));
  }

  function onBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function validateAll(): boolean {
    return validate(activeFields);
  }

  function toSubmissionValues() {
    return fields.map((field) => ({ fieldId: field.id, value: values[field.id] ?? "" }));
  }

  const clearSavedResponse = useCallback(() => {
    setResumeDisabled(true);
    if (!resumeKey) return;
    try {
      sessionStorage.removeItem(resumeKey);
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [resumeKey]);

  return {
    step: currentStep,
    stepCount,
    stepStartIndex: currentStep * pageSize,
    setStep,
    values,
    setValues,
    missingFieldIds,
    visibleFields,
    activeFields,
    activePath,
    isFirstStep,
    isLastStep,
    isRestoring,
    onChange,
    onNext,
    onBack,
    validateAll,
    toSubmissionValues,
    clearSavedResponse,
  };
}
