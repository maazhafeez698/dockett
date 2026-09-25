// apps/web/components/form-field-renderer.tsx
//
// Renders one field as a respondent would fill it in. Used verbatim by both
// the public fill page (app/form/[id]/page.tsx) and the builder's live
// preview pane — that's deliberate: the preview should be the real
// component, not a lookalike that can drift out of sync with it.

"use client";

import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";

export interface FieldConfig {
  options?: string[];
  maxLength?: number;
  max?: number;
}

export interface RendererField {
  id: string;
  label: string;
  description?: string | null;
  placeholder?: string | null;
  isRequired: boolean;
  type: string;
  config?: unknown;
}

interface FormFieldRendererProps {
  field: RendererField;
  value: string;
  onChange: (value: string) => void;
  isMissing?: boolean;
  /** Accent hex from the form's theme — used for the rating scale's selected state. */
  accent?: string;
  fieldBackground?: string;
  fieldForeground?: string;
}

export function FormFieldRenderer({
  field: f,
  value,
  onChange,
  isMissing = false,
  accent = "var(--primary)",
  fieldBackground = "var(--background)",
  fieldForeground = "var(--foreground)",
}: FormFieldRendererProps) {
  const config = (f.config ?? {}) as FieldConfig;
  const inputClass = isMissing ? "border-destructive" : undefined;
  const fieldStyle = { backgroundColor: fieldBackground, color: fieldForeground };

  const toggleMultiValue = (option: string) => {
    const current = value ? value.split(",").filter(Boolean) : [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    onChange(next.join(","));
  };

  return (
    <div className="space-y-1.5">
      <label
        className="block text-sm font-medium"
        style={{ color: fieldForeground }}
      >
        {f.label}
        {f.isRequired ? <span className="ml-1 text-destructive">*</span> : null}
      </label>

      {f.type === "TEXT" && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={inputClass}
          style={fieldStyle}
        />
      )}

      {f.type === "LONG_TEXT" && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          maxLength={config.maxLength}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={inputClass}
          style={fieldStyle}
        />
      )}

      {f.type === "NUMBER" && (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={inputClass}
          style={fieldStyle}
        />
      )}

      {f.type === "EMAIL" && (
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={inputClass}
          style={fieldStyle}
        />
      )}

      {f.type === "PASSWORD" && (
        <Input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder ?? ""}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={inputClass}
          style={fieldStyle}
        />
      )}

      {f.type === "DATE" && (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={inputClass}
          style={fieldStyle}
        />
      )}

      {f.type === "RATING" && (
        <div className="flex gap-2">
          {Array.from({ length: config.max ?? 5 }, (_, i) => i + 1).map((n) => {
            const selected = value === String(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                style={
                  selected ? { background: accent, borderColor: accent, color: "#fff" } : undefined
                }
                className={`size-9 rounded-lg border text-sm font-medium transition-colors ${
                  selected ? "" : "border-border bg-muted/40 text-foreground/70 hover:bg-muted"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}

      {f.type === "YES_NO" && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={`w-full rounded-lg border bg-transparent px-3 py-2 text-sm ${
            isMissing ? "border-destructive" : "border-input"
          }`}
          style={fieldStyle}
        >
          <option value="" style={fieldStyle}>Select...</option>
          <option value="true" style={fieldStyle}>Yes</option>
          <option value="false" style={fieldStyle}>No</option>
        </select>
      )}

      {f.type === "DROPDOWN" && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={f.isRequired}
          aria-invalid={isMissing}
          className={`w-full rounded-lg border bg-transparent px-3 py-2 text-sm ${
            isMissing ? "border-destructive" : "border-input"
          }`}
          style={fieldStyle}
        >
          <option value="" style={fieldStyle}>Select...</option>
          {(config.options ?? []).map((opt) => (
            <option key={opt} value={opt} style={fieldStyle}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {(f.type === "MULTI_SELECT" || f.type === "CHECKBOX_GROUP") && (
        <div className="space-y-2">
          {(config.options ?? []).map((opt) => {
            const selected = value.split(",").filter(Boolean).includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 text-sm"
                style={{ color: fieldForeground }}
              >
                <Checkbox checked={selected} onCheckedChange={() => toggleMultiValue(opt)} />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {f.description ? (
        <div className="text-sm" style={{ color: fieldForeground, opacity: 0.72 }}>
          {f.description}
        </div>
      ) : null}
      {isMissing ? <div className="text-sm text-destructive">This field is required.</div> : null}
    </div>
  );
}
