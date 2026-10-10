// apps/web/components/builder/field-inspector.tsx
//
// The right-hand inspector. One component serves the List view ("SAVE
// CHANGES") and the Node view ("SAVE NODE") so a field is edited the same way
// in both. With nothing selected it edits the form itself.

"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  GALLERY_TEMPLATE_IDS,
  getTemplateDesign,
} from "~/lib/template-designs";
import {
  OPTION_TYPES,
  typeLabel,
  type BuilderField,
  type FieldConfig,
  type FieldType,
} from "./field-types";

export interface FieldPatch {
  label: string;
  description: string | null;
  placeholder: string | null;
  isRequired: boolean;
  config: FieldConfig | undefined;
}

interface FormSettings {
  description?: string | null;
  template?: string | null;
  submissionLayout?: string | null;
}

interface FieldInspectorProps {
  mode: "list" | "nodes";
  field: BuilderField | null;
  /** 1-based position of the selected field (shown as "NODE 05"). */
  position?: number;
  form: FormSettings | undefined;
  premiumUnlocked: boolean;
  saving: boolean;
  savingForm: boolean;
  onSave: (fieldId: string, patch: FieldPatch) => Promise<void>;
  onDelete: (fieldId: string) => void;
  onDescriptionBlur: (value: string) => void;
  onTemplateChange: (templateId: string) => void;
  onLayoutChange: (layout: "ONE_AT_A_TIME" | "ALL_AT_ONCE") => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="mono-label-sm border-b border-dashed border-border pb-1.5 text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function FormSection({
  form,
  premiumUnlocked,
  savingForm,
  showDescription,
  onDescriptionBlur,
  onTemplateChange,
  onLayoutChange,
}: Pick<
  FieldInspectorProps,
  "form" | "premiumUnlocked" | "savingForm" | "onDescriptionBlur" | "onTemplateChange" | "onLayoutChange"
> & { showDescription: boolean }) {
  const layout = form?.submissionLayout === "ALL_AT_ONCE" ? "ALL_AT_ONCE" : "ONE_AT_A_TIME";

  return (
    <div className="space-y-4">
      {showDescription ? (
        <div className="space-y-1.5">
          <Label htmlFor="form-description">Description</Label>
          <Textarea
            id="form-description"
            key={form?.description ?? ""}
            defaultValue={form?.description ?? ""}
            rows={3}
            onBlur={(e) => onDescriptionBlur(e.target.value)}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="form-template">Template</Label>
        <div className="relative">
          <select
            id="form-template"
            value={form?.template ?? "CLASSIC"}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="border-input focus-visible:border-primary focus-visible:ring-ring h-10 w-full appearance-none rounded-sm border bg-card px-3 pr-8 font-mono text-[13px] outline-none focus-visible:ring-[3px]"
          >
            <option value="CLASSIC">Classic (default)</option>
            {GALLERY_TEMPLATE_IDS.map((id) => {
              const locked = !premiumUnlocked && ["DEVELOPER", "RETRO", "TICKET"].includes(id);
              return (
                <option key={id} value={id} disabled={locked}>
                  {getTemplateDesign(id).name}
                  {locked ? " (Pro)" : ""}
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Changes the structure and design of the public submission page.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Field pacing</Label>
        <div className="grid grid-cols-2 border border-foreground/70 p-0.5" role="group" aria-label="Field pacing">
          {(
            [
              ["ONE_AT_A_TIME", "One at a time"],
              ["ALL_AT_ONCE", "All at once"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => onLayoutChange(value)}
              className={`mono-label-sm rounded-[2px] px-2 py-2.5 leading-tight transition-colors ${
                layout === value
                  ? "bg-solid text-solid-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {savingForm ? <p className="mono-label-sm text-muted-foreground">Saving…</p> : null}
    </div>
  );
}

function FieldEditor({
  field,
  mode,
  position,
  saving,
  onSave,
  onDelete,
  extra,
}: Pick<FieldInspectorProps, "field" | "mode" | "position" | "saving" | "onSave" | "onDelete"> & {
  field: BuilderField;
  extra?: React.ReactNode;
}) {
  const type = field.type as FieldType;
  const cfg = (field.config ?? {}) as FieldConfig;

  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.description ?? "");
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "");
  const [required, setRequired] = useState(field.isRequired);
  const [options, setOptions] = useState<string[]>(
    cfg.options && cfg.options.length > 0 ? cfg.options : [""],
  );
  const [maxLength, setMaxLength] = useState(cfg.maxLength ? String(cfg.maxLength) : "");
  const [ratingMax, setRatingMax] = useState(cfg.max ? String(cfg.max) : "5");

  const buildConfig = (): FieldConfig | undefined => {
    if (OPTION_TYPES.has(type)) return { options: options.map((o) => o.trim()).filter(Boolean) };
    if (type === "LONG_TEXT" && maxLength.trim()) return { maxLength: Number(maxLength) };
    if (type === "RATING") return { max: ratingMax.trim() ? Number(ratingMax) : 5 };
    return undefined;
  };

  const handleSave = () =>
    onSave(field.id, {
      label: label.trim(),
      description: description.trim() ? description.trim() : null,
      placeholder: placeholder.trim() ? placeholder.trim() : null,
      isRequired: required,
      config: buildConfig(),
    });

  const showPlaceholder = !OPTION_TYPES.has(type) && type !== "YES_NO" && type !== "RATING";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {mode === "nodes" ? (
              <div className="mono-label-sm text-muted-foreground">
                Node {String(position ?? 0).padStart(2, "0")} · {typeLabel(type).toUpperCase()}
              </div>
            ) : null}
            <h3 className="font-display truncate text-xl font-extrabold">
              {mode === "nodes" ? field.label : typeLabel(type)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onDelete(field.id)}
            aria-label="Delete field"
            className="p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-label">Label</Label>
          <Input
            id="field-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What is your name?"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-description">Description</Label>
          <Textarea
            id="field-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {showPlaceholder ? (
          <div className="space-y-1.5">
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Enter your name…"
            />
          </div>
        ) : null}

        {OPTION_TYPES.has(type) ? (
          <div className="space-y-1.5">
            <Label>Options</Label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Option ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions([...options, ""])}
              >
                <Plus /> Add option
              </Button>
            </div>
          </div>
        ) : null}

        {type === "LONG_TEXT" ? (
          <div className="space-y-1.5">
            <Label htmlFor="field-maxlength">Max length (optional)</Label>
            <Input
              id="field-maxlength"
              type="number"
              value={maxLength}
              onChange={(e) => setMaxLength(e.target.value)}
            />
          </div>
        ) : null}

        {type === "RATING" ? (
          <div className="space-y-1.5">
            <Label htmlFor="field-scale">Scale (2-10)</Label>
            <Input
              id="field-scale"
              type="number"
              min={2}
              max={10}
              value={ratingMax}
              onChange={(e) => setRatingMax(e.target.value)}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between border-y border-dashed border-border py-3">
          <Label htmlFor="field-required" className="cursor-pointer">
            Required
          </Label>
          <Switch id="field-required" checked={required} onCheckedChange={setRequired} />
        </div>

        {extra}
      </div>

      <div className="border-t border-border p-4">
        <Button className="w-full" onClick={handleSave} disabled={saving || !label.trim()}>
          {saving ? "Saving…" : mode === "nodes" ? "Save node" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export function FieldInspector(props: FieldInspectorProps) {
  const { field, mode } = props;

  if (field) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {/* key: reset the draft whenever a different field is selected */}
        <FieldEditor
          key={field.id}
          field={field}
          mode={mode}
          position={props.position}
          saving={props.saving}
          onSave={props.onSave}
          onDelete={props.onDelete}
          extra={
            mode === "list" ? (
              <FormSection {...props} showDescription={false} />
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <div>
        <h3 className="font-display text-xl font-extrabold">Form details</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          No field selected — editing the form itself.
        </p>
      </div>
      <Section title="Form">
        <FormSection {...props} showDescription />
      </Section>
    </div>
  );
}
