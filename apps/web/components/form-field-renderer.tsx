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
import { cn } from "~/lib/utils";

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
  /**
   * "template" (default): sans-serif inputs for the bespoke template shells.
   * "ticket": Dockett's large one-question-at-a-time input (mono, big).
   * "ticket-form": Dockett's all-at-once input (mono, standard height).
   */
  variant?: "template" | "ticket" | "ticket-form";
  /** The shell already shows the label (and description) as a heading. */
  hideLabel?: boolean;
  autoFocus?: boolean;
}

export function FormFieldRenderer({
  field: f,
  value,
  onChange,
  isMissing = false,
  accent = "var(--primary)",
  fieldBackground = "var(--background)",
  fieldForeground = "var(--foreground)",
  variant = "template",
  hideLabel = false,
  autoFocus = false,
}: FormFieldRendererProps) {
  const config = (f.config ?? {}) as FieldConfig;
  const big = variant === "ticket";
  const ticket = variant !== "template";
  const inputClass = cn(
    ticket ? "font-mono" : "font-sans text-sm",
    big && "h-14 border-foreground/70 px-4 text-base sm:text-lg",
    ticket && !big && "border-foreground/50",
    isMissing && "border-destructive",
  );
  const selectClass = cn(
    "w-full rounded-sm border bg-transparent px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
    ticket ? "font-mono" : "font-sans py-2",
    big ? "h-14 border-foreground/70 text-base sm:text-lg" : ticket ? "h-10 border-foreground/50" : "",
    isMissing ? "border-destructive" : "border-input",
  );
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
      {hideLabel ? null : (
        <label
          className={cn("block", ticket ? "text-sm font-bold" : "text-sm font-medium")}
          style={{ color: fieldForeground }}
        >
          {f.label}
          {f.isRequired ? <span className="ml-1 text-destructive">*</span> : null}
        </label>
      )}

      {f.type === "TEXT" && (
        <Input
          autoFocus={autoFocus}
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
          autoFocus={autoFocus}
          rows={big ? 4 : undefined}
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
          autoFocus={autoFocus}
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
          autoFocus={autoFocus}
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
          autoFocus={autoFocus}
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
          autoFocus={autoFocus}
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
                className={cn(
                  "rounded-sm border text-sm font-medium transition-colors",
                  ticket && "font-mono",
                  big ? "size-12 text-base" : "size-9",
                  selected ? "" : "border-foreground/40 bg-transparent text-foreground/70 hover:border-primary hover:text-foreground",
                )}
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
          className={selectClass}
          autoFocus={autoFocus}
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
          className={selectClass}
          autoFocus={autoFocus}
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
                className={cn("flex items-center gap-2 text-sm", ticket && "font-mono")}
                style={{ color: fieldForeground }}
              >
                <Checkbox checked={selected} onCheckedChange={() => toggleMultiValue(opt)} />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {f.description && !hideLabel ? (
        <div className={cn("text-sm", ticket && "text-xs")} style={{ color: fieldForeground, opacity: 0.72 }}>
          {f.description}
        </div>
      ) : null}
      {isMissing ? <div className="text-sm text-destructive">This field is required.</div> : null}
    </div>
  );
}
