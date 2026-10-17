// apps/web/components/form-field-renderer.tsx
//
// Renders one field as a respondent would fill it in. Used verbatim by both
// the public fill page (app/form/[id]/page.tsx) and the builder's live
// preview pane — that's deliberate: the preview should be the real
// component, not a lookalike that can drift out of sync with it.

"use client";

import { useState } from "react";
import { Check, ChevronDown, Star } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { FileUploadField } from "~/components/file-upload-field";
import { parseFileAnswer } from "~/lib/file-answer";
import { numberProblem } from "~/lib/field-rules";
import { cn } from "~/lib/utils";

export interface FieldConfig {
  options?: string[];
  maxLength?: number;
  /** rating scale (stars) */
  max?: number;
  /** NUMBER */
  minValue?: number;
  maxValue?: number;
  step?: number;
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
  const [hoverStar, setHoverStar] = useState(0);
  const [multiOpen, setMultiOpen] = useState(false);
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
          min={config.minValue}
          max={config.maxValue}
          step={config.step ?? "any"}
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
        <div
          role="radiogroup"
          aria-label={f.label}
          className="flex gap-1"
          onMouseLeave={() => setHoverStar(0)}
        >
          {Array.from({ length: config.max ?? 5 }, (_, i) => i + 1).map((n) => {
            const current = Number(value) || 0;
            const lit = n <= (hoverStar || current);
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={current === n}
                aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                onClick={() => onChange(current === n ? "" : String(n))}
                onMouseEnter={() => setHoverStar(n)}
                onFocus={() => setHoverStar(n)}
                onBlur={() => setHoverStar(0)}
                className="rounded-sm p-0.5 transition-transform outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <Star
                  className={big ? "size-9" : "size-7"}
                  strokeWidth={1.6}
                  style={{
                    color: lit ? accent : fieldForeground,
                    fill: lit ? accent : "transparent",
                    opacity: lit ? 1 : 0.45,
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {f.type === "YES_NO" && (
        <div role="radiogroup" aria-label={f.label} className="grid grid-cols-2 gap-2">
          {(
            [
              ["true", "Yes"],
              ["false", "No"],
            ] as const
          ).map(([v, text]) => {
            const selected = value === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(selected ? "" : v)}
                autoFocus={autoFocus && v === "true"}
                style={selected ? { background: accent, borderColor: accent, color: "#fff" } : fieldStyle}
                className={cn(
                  "rounded-sm border text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                  ticket && "font-mono",
                  big ? "h-14 text-base sm:text-lg" : "h-10",
                  selected
                    ? ""
                    : isMissing
                      ? "border-destructive"
                      : "border-input hover:border-primary",
                )}
              >
                {text}
              </button>
            );
          })}
        </div>
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

      {f.type === "MULTI_SELECT" && (
        <Popover open={multiOpen} onOpenChange={setMultiOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={multiOpen}
              autoFocus={autoFocus}
              style={fieldStyle}
              className={cn(selectClass, "flex items-center justify-between gap-2 text-left")}
            >
              <span className="truncate">
                {value
                  ? value.split(",").filter(Boolean).join(", ")
                  : <span className="opacity-60">Select...</span>}
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
            <ul role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto">
              {(config.options ?? []).map((opt) => {
                const selected = value.split(",").filter(Boolean).includes(opt);
                return (
                  <li key={opt} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => toggleMultiValue(opt)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        ticket && "font-mono",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[2px] border",
                          selected ? "border-solid bg-solid text-solid-foreground" : "border-input",
                        )}
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </span>
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}

      {f.type === "CHECKBOX_GROUP" && (
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

      {f.type === "RADIO_GROUP" && (
        <RadioGroup
          value={value}
          onValueChange={onChange}
          aria-label={f.label}
          aria-invalid={isMissing}
          className="gap-2"
        >
          {(config.options ?? []).map((opt, i) => {
            const id = `${f.id}-opt-${i}`;
            return (
              <label
                key={opt}
                htmlFor={id}
                className={cn("flex cursor-pointer items-center gap-2 text-sm", ticket && "font-mono")}
                style={{ color: fieldForeground }}
              >
                <RadioGroupItem id={id} value={opt} />
                {opt}
              </label>
            );
          })}
        </RadioGroup>
      )}

      {f.type === "FILE_UPLOAD" && (
        <FileUploadField
          fieldId={f.id}
          label={f.label}
          config={f.config}
          value={value}
          onChange={onChange}
          isMissing={isMissing}
        />
      )}

      {f.description && !hideLabel ? (
        <div className={cn("text-sm", ticket && "text-xs")} style={{ color: fieldForeground, opacity: 0.72 }}>
          {f.description}
        </div>
      ) : null}
      {isMissing ? (
        <div className="text-sm text-destructive">
          {f.type === "FILE_UPLOAD" && parseFileAnswer(value).busy
            ? "Wait for the upload to finish."
            : f.type === "NUMBER" && value.trim() !== ""
              ? (numberProblem(value, config) ?? "Please enter a valid number.")
              : "This field is required."}
        </div>
      ) : null}
    </div>
  );
}
