import { createHash } from "node:crypto";
import type { FormSnapshot, FormSnapshotField } from "@repo/database/models/form-version";
import type { FormDesignSettings } from "@repo/database/models/form";
import { env } from "../env";

export const MIN_AUTO_CLOSE_MINUTES = 5;
export const MAX_AUTO_CLOSE_MINUTES = 30 * 24 * 60; // 30 days

export const inactivityMs = () => env.FORM_INACTIVITY_CLOSE_DAYS * 24 * 60 * 60 * 1000;

export type ClosedReason = "MANUAL" | "SCHEDULED" | "INACTIVE";
export type EffectiveStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

interface TimingRow {
  status: string;
  closesAt: Date | null;
  lastActivityAt: Date | null;
  closedReason: string | null;
}

export function effectiveState(
  f: TimingRow,
  now: Date = new Date(),
): { status: EffectiveStatus; closedReason: ClosedReason | null; due: boolean } {
  const status = f.status as EffectiveStatus;
  if (status === "PUBLISHED") {
    if (f.closesAt && f.closesAt.getTime() <= now.getTime()) {
      return { status: "CLOSED", closedReason: "SCHEDULED", due: true };
    }
    if (f.lastActivityAt && f.lastActivityAt.getTime() + inactivityMs() <= now.getTime()) {
      return { status: "CLOSED", closedReason: "INACTIVE", due: true };
    }
    return { status, closedReason: null, due: false };
  }
  return { status, closedReason: (f.closedReason as ClosedReason | null) ?? null, due: false };
}

interface LiveFieldRow {
  id: string;
  formId: string | null;
  label: string;
  labelKey: string;
  description: string | null;
  placeholder: string | null;
  isRequired: boolean;
  config: unknown;
  index: unknown;
  type: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function buildSnapshot(
  form: { title: string; description: string | null; template: string; submissionLayout: string; designSettings?: FormDesignSettings | null },
  fields: LiveFieldRow[],
): FormSnapshot {
  const snapFields: FormSnapshotField[] = fields.map((f) => ({
    id: f.id,
    formId: f.formId,
    label: f.label,
    labelKey: f.labelKey,
    description: f.description ?? null,
    placeholder: f.placeholder ?? null,
    isRequired: f.isRequired,
    config: f.config ?? null,
    index: String(f.index),
    type: f.type,
    createdAt: f.createdAt ? f.createdAt.toISOString() : null,
    updatedAt: f.updatedAt ? f.updatedAt.toISOString() : null,
  }));
  return {
    title: form.title,
    description: form.description ?? null,
    template: form.template,
    submissionLayout: form.submissionLayout,
    designSettings: form.designSettings ?? {},
    fields: snapFields,
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function hashSnapshot(s: FormSnapshot): string {
  const content = {
    title: s.title,
    description: s.description,
    template: s.template,
    submissionLayout: s.submissionLayout,
    designSettings: s.designSettings ?? {},
    fields: s.fields.map((f) => ({
      id: f.id,
      label: f.label,
      labelKey: f.labelKey,
      description: f.description,
      placeholder: f.placeholder,
      isRequired: f.isRequired,
      config: f.config ?? null,
      index: f.index,
      type: f.type,
    })),
  };
  return createHash("sha256").update(canonical(content)).digest("hex");
}
