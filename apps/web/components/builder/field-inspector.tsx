// apps/web/components/builder/field-inspector.tsx
//
// The right-hand inspector. One component serves the List view ("SAVE
// CHANGES") and the Node view ("SAVE NODE") so a field is edited the same way
// in both. With nothing selected it edits the form itself.

"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { GALLERY_TEMPLATE_IDS, getTemplateDesign } from "~/lib/template-designs";
import {
  analyzeConditionalLogic,
  END_FORM,
  logicChoices,
  NEXT_QUESTION,
} from "@repo/services/form-logic";
import {
  OPTION_TYPES,
  typeLabel,
  type AcceptedFileKind,
  type BuilderField,
  type FieldConfig,
  type FieldType,
} from "./field-types";

const FILE_KIND_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
] as const satisfies readonly { value: AcceptedFileKind; label: string }[];

const NUMBER_LOGIC_OPERATORS = [
  { value: "EQ", label: "=" },
  { value: "GT", label: ">" },
  { value: "LT", label: "<" },
  { value: "GTE", label: ">=" },
  { value: "LTE", label: "<=" },
] as const;

type LogicRuleConfig = NonNullable<FieldConfig["logic"]>["rules"][number];
type LogicCondition = NonNullable<LogicRuleConfig["conditions"]>[number];

function conditionsForNumberRule(rule: LogicRuleConfig): LogicCondition[] {
  return rule.conditions?.length
    ? rule.conditions
    : [{ operator: rule.operator ?? "EQ", value: rule.answer }];
}

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
  allFields: BuilderField[];
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
  | "form"
  | "premiumUnlocked"
  | "savingForm"
  | "onDescriptionBlur"
  | "onTemplateChange"
  | "onLayoutChange"
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
        <div
          className="grid grid-cols-2 border border-foreground/70 p-0.5"
          role="group"
          aria-label="Field pacing"
        >
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
        <p className="text-[11px] leading-snug text-muted-foreground">
          Conditional logic works with <span className="font-medium text-foreground">One at a time</span> pacing.
        </p>
      </div>

      {savingForm ? <p className="mono-label-sm text-muted-foreground">Saving…</p> : null}
    </div>
  );
}

function FieldEditor({
  field,
  allFields,
  logicAvailableForLayout,
  mode,
  position,
  saving,
  onSave,
  onDelete,
}: Pick<FieldInspectorProps, "field" | "allFields" | "mode" | "position" | "saving" | "onSave" | "onDelete"> & {
  logicAvailableForLayout: boolean;
  field: BuilderField;
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
  const [minValue, setMinValue] = useState(cfg.minValue !== undefined ? String(cfg.minValue) : "");
  const [maxValue, setMaxValue] = useState(cfg.maxValue !== undefined ? String(cfg.maxValue) : "");
  const [step, setStep] = useState(cfg.step !== undefined ? String(cfg.step) : "");
  const [accept, setAccept] = useState<AcceptedFileKind[]>(
    cfg.accept && cfg.accept.length > 0 ? cfg.accept : [...FILE_KIND_OPTIONS.map((k) => k.value)],
  );
  const [maxFiles, setMaxFiles] = useState(String(cfg.maxFiles ?? 1));
  const [maxSizeMB, setMaxSizeMB] = useState(String(cfg.maxSizeMB ?? 5));
  const [logicEnabled, setLogicEnabled] = useState(!!cfg.logic);
  const [logicRules, setLogicRules] = useState(cfg.logic?.rules ?? []);
  const choices = logicChoices({
    id: field.id,
    label,
    type,
    isRequired: required,
    config: { ...cfg, options: OPTION_TYPES.has(type) ? options.map((option) => option.trim()).filter(Boolean) : cfg.options, max: type === "RATING" ? Number(ratingMax) || 5 : cfg.max },
  });
  const ruleAnswers = type === "NUMBER" ? logicRules.map((rule) => rule.answer) : choices;

  const withLogic = (base?: FieldConfig): FieldConfig | undefined => {
    const next = { ...(base ?? {}) };
    if (logicEnabled && (choices.length > 0 || type === "NUMBER")) {
      if (type === "NUMBER") {
        next.logic = { rules: logicRules };
        return Object.keys(next).length > 0 ? next : undefined;
      }
      const existing = new Map(logicRules.map((rule) => [rule.answer, rule.targetFieldId]));
      next.logic = {
        rules: choices.map((answer) => ({ answer, targetFieldId: existing.get(answer) ?? NEXT_QUESTION })),
      };
    } else {
      delete next.logic;
    }
    return Object.keys(next).length > 0 ? next : undefined;
  };

  const buildConfig = (): FieldConfig | undefined => {
    if (OPTION_TYPES.has(type)) return withLogic({ ...cfg, options: options.map((o) => o.trim()).filter(Boolean) });
    if (type === "LONG_TEXT" && maxLength.trim()) return withLogic({ ...cfg, maxLength: Number(maxLength) });
    if (type === "RATING") return withLogic({ ...cfg, max: ratingMax.trim() ? Number(ratingMax) : 5 });
    if (type === "NUMBER") {
      const c: FieldConfig = {};
      if (minValue.trim() !== "" && Number.isFinite(Number(minValue)))
        c.minValue = Number(minValue);
      if (maxValue.trim() !== "" && Number.isFinite(Number(maxValue)))
        c.maxValue = Number(maxValue);
      if (step.trim() !== "" && Number(step) > 0) c.step = Number(step);
      return withLogic({ ...cfg, ...c });
    }
    if (type === "FILE_UPLOAD") {
      return withLogic({ ...cfg,
        accept: accept.length > 0 ? accept : FILE_KIND_OPTIONS.map((k) => k.value),
        maxFiles: Math.min(5, Math.max(1, Math.round(Number(maxFiles) || 1))),
        maxSizeMB: Math.min(10, Math.max(0.1, Number(maxSizeMB) || 5)),
      });
    }
    return withLogic(cfg);
  };

  const handleSave = () =>
    onSave(field.id, {
      label: label.trim(),
      description: description.trim() ? description.trim() : null,
      placeholder: placeholder.trim() ? placeholder.trim() : null,
      isRequired: required,
      config: buildConfig(),
    });

  const showPlaceholder =
    !OPTION_TYPES.has(type) &&
    type !== "YES_NO" &&
    type !== "RATING" &&
    type !== "FILE_UPLOAD" &&
    type !== "DATE";

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

        {type === "NUMBER" ? (
          <div className="space-y-1.5">
            <Label>Limits (optional)</Label>
            <div className="grid grid-cols-3 gap-1.5">
              <Input
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="Min"
                aria-label="Minimum value"
              />
              <Input
                type="number"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder="Max"
                aria-label="Maximum value"
              />
              <Input
                type="number"
                min={0}
                value={step}
                onChange={(e) => setStep(e.target.value)}
                placeholder="Step"
                aria-label="Step"
              />
            </div>
          </div>
        ) : null}

        {type === "FILE_UPLOAD" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Accepted files</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {FILE_KIND_OPTIONS.map((k) => {
                  const on = accept.includes(k.value);
                  return (
                    <label
                      key={k.value}
                      className="flex cursor-pointer items-center gap-2 border border-input px-2.5 py-2 font-mono text-[11px]"
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={() =>
                          setAccept(on ? accept.filter((v) => v !== k.value) : [...accept, k.value])
                        }
                      />
                      {k.label}
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Only these four types can ever be uploaded. Files are checked on the server, not
                just by name.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-1.5">
                <Label htmlFor="field-maxfiles">Max files (1-5)</Label>
                <Input
                  id="field-maxfiles"
                  type="number"
                  min={1}
                  max={5}
                  value={maxFiles}
                  onChange={(e) => setMaxFiles(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="field-maxsize">Max size (MB)</Label>
                <Input
                  id="field-maxsize"
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.5}
                  value={maxSizeMB}
                  onChange={(e) => setMaxSizeMB(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {type === "RATING" ? (
          <div className="space-y-1.5">
            <Label htmlFor="field-scale">Stars (2-10)</Label>
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

        {choices.length > 0 || type === "NUMBER" ? (
          <Section title="Conditional logic">
            {!logicEnabled ? (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {logicAvailableForLayout
                    ? "Send people to a different question based on their answer."
                    : "Conditional logic requires One at a time. Change Field pacing in Form details to use it."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!logicAvailableForLayout}
                  onClick={() => {
                    const existing = new Map(logicRules.map((rule) => [rule.answer, rule.targetFieldId]));
                    setLogicRules(type === "NUMBER"
                      ? (logicRules.length > 0
                        ? logicRules.map((rule) => {
                          const conditions = conditionsForNumberRule(rule);
                          return { ...rule, answer: conditions[0]?.value ?? rule.answer, operator: conditions[0]?.operator ?? "EQ", conditions };
                        })
                        : [{ answer: "0", operator: "EQ", targetFieldId: NEXT_QUESTION, conditions: [{ operator: "EQ", value: "0" }], conditionJoin: "AND" }])
                      : choices.map((answer) => ({ answer, targetFieldId: existing.get(answer) ?? NEXT_QUESTION })));
                    setLogicEnabled(true);
                  }}
                >
                  Add logic
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {!logicAvailableForLayout ? (
                  <p className="rounded-sm border border-primary/50 bg-primary/5 p-2.5 text-xs leading-relaxed">
                    These routes need <span className="font-medium">One at a time</span> field pacing. Change it in Form details before publishing.
                  </p>
                ) : null}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {type === "NUMBER"
                    ? "Combine comparisons with AND or OR. Overlapping routes that lead to different questions are flagged."
                    : "If the answer matches, go to that question. Otherwise, continue to the next question."}
                </p>
                {ruleAnswers.map((answer, ruleIndex) => {
                  const numberRule = logicRules[ruleIndex];
                  const numberConditions = type === "NUMBER" && numberRule ? conditionsForNumberRule(numberRule) : [];
                  const conditionJoin = numberRule?.conditionJoin ?? "AND";
                  const selectedTarget = logicRules.find((rule) => rule.answer === answer)?.targetFieldId ?? NEXT_QUESTION;
                  const destination = allFields.find((candidate) => candidate.id === selectedTarget);
                  return (
                    <div key={`${answer}-${ruleIndex}`} className="space-y-1.5 rounded-sm border border-border p-2.5">
                      {type === "NUMBER" ? (
                        <div className="space-y-2">
                          {numberConditions.length > 1 ? (
                            <Label className="flex items-center gap-2 text-xs">
                              Match
                              <select
                                value={conditionJoin}
                                aria-label={`How number conditions combine for route ${ruleIndex + 1}`}
                                onChange={(event) => setLogicRules((current) => current.map((rule, index) => index === ruleIndex
                                  ? { ...rule, conditionJoin: event.target.value as "AND" | "OR" }
                                  : rule))}
                                className="border-input h-8 rounded-sm border bg-card px-2 font-mono text-xs"
                              >
                                <option value="AND">all conditions (AND)</option>
                                <option value="OR">any condition (OR)</option>
                              </select>
                            </Label>
                          ) : null}
                          {numberConditions.map((condition, conditionIndex) => (
                            <div key={`${ruleIndex}-${conditionIndex}`} className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
                              <select
                                aria-label={`Number comparison ${conditionIndex + 1} for route ${ruleIndex + 1}`}
                                value={condition.operator}
                                onChange={(event) => setLogicRules((current) => current.map((rule, index) => {
                                  if (index !== ruleIndex) return rule;
                                  const conditions = conditionsForNumberRule(rule).map((item, i) => i === conditionIndex
                                    ? { ...item, operator: event.target.value as LogicCondition["operator"] }
                                    : item);
                                  return { ...rule, answer: conditions[0]!.value, operator: conditions[0]!.operator, conditions };
                                }))}
                                className="border-input h-9 rounded-sm border bg-card px-2 font-mono text-sm"
                              >
                                {NUMBER_LOGIC_OPERATORS.map((operator) => (
                                  <option key={operator.value} value={operator.value}>{operator.label}</option>
                                ))}
                              </select>
                              <Input
                                type="number"
                                step="any"
                                value={condition.value}
                                aria-label={`Number value ${conditionIndex + 1} for route ${ruleIndex + 1}`}
                                onChange={(event) => setLogicRules((current) => current.map((rule, index) => {
                                  if (index !== ruleIndex) return rule;
                                  const conditions = conditionsForNumberRule(rule).map((item, i) => i === conditionIndex
                                    ? { ...item, value: event.target.value }
                                    : item);
                                  return { ...rule, answer: conditions[0]!.value, conditions };
                                }))}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={numberConditions.length <= 1}
                                aria-label={`Remove condition ${conditionIndex + 1}`}
                                onClick={() => setLogicRules((current) => current.map((rule, index) => {
                                  if (index !== ruleIndex) return rule;
                                  const conditions = conditionsForNumberRule(rule).filter((_, i) => i !== conditionIndex);
                                  return { ...rule, conditions, answer: conditions[0]?.value ?? rule.answer, operator: conditions[0]?.operator ?? rule.operator };
                                }))}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogicRules((current) => current.map((rule, index) => index === ruleIndex
                              ? { ...rule, conditions: [...conditionsForNumberRule(rule), { operator: "GTE", value: "0" }] }
                              : rule))}
                          >
                            Add condition
                          </Button>
                        </div>
                      ) : (
                        <div className="font-mono text-[11px] font-medium">
                          If answer is {type === "YES_NO" ? (answer === "true" ? "Yes" : "No") : answer}
                        </div>
                      )}
                      <select
                        aria-label={`Where to go when the answer is ${answer}`}
                        value={selectedTarget}
                        onChange={(event) => {
                          const targetFieldId = event.target.value;
                          if (type === "NUMBER") {
                            setLogicRules((current) => current.map((rule, index) => index === ruleIndex ? { ...rule, targetFieldId } : rule));
                          } else {
                            setLogicRules((current) => choices.map((choice) => ({
                              answer: choice,
                              targetFieldId: choice === answer
                                ? targetFieldId
                                : current.find((rule) => rule.answer === choice)?.targetFieldId ?? NEXT_QUESTION,
                            })));
                          }
                        }}
                        className="border-input focus-visible:border-primary focus-visible:ring-ring h-9 w-full rounded-sm border bg-card px-2 font-mono text-[11px] outline-none focus-visible:ring-[3px]"
                      >
                        <option value={NEXT_QUESTION}>Continue to next question</option>
                        {allFields.map((candidate, index) => index >= (position ?? 1) ? (
                          <option key={candidate.id} value={candidate.id}>
                            {index === (position ?? 1) ? "Go to: " : "Skip ahead to: "}{candidate.label}
                          </option>
                        ) : null)}
                        <option value={END_FORM}>End the form</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground">
                        Preview: {type === "NUMBER"
                          ? numberConditions.map((condition) => `${NUMBER_LOGIC_OPERATORS.find((operator) => operator.value === condition.operator)?.label} ${condition.value}`).join(conditionJoin === "AND" ? " AND " : " OR ")
                          : type === "YES_NO" ? (answer === "true" ? "Yes" : "No") : answer} -&gt; {selectedTarget === END_FORM ? "End form" : destination?.label ?? "Next question"}
                      </p>
                      {type === "NUMBER" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={logicRules.length <= 1}
                          onClick={() => setLogicRules((current) => current.filter((_, index) => index !== ruleIndex))}
                        >
                          Remove this route
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
                {type === "NUMBER" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLogicRules((current) => {
                      const used = new Set(current.map((rule) => Number(rule.answer)).filter(Number.isFinite));
                      let suggested = 0;
                      while (used.has(suggested)) suggested += 1;
                      const value = String(suggested);
                      return [...current, { answer: value, operator: "EQ", targetFieldId: NEXT_QUESTION, conditions: [{ operator: "EQ", value }], conditionJoin: "AND" }];
                    })}
                  >
                    Add another number route
                  </Button>
                ) : null}
                {(() => {
                  const analysis = analyzeConditionalLogic(allFields);
                  const issues = [...analysis.errors, ...analysis.warnings].filter((issue) => issue.fieldId === field.id);
                  return issues.length > 0 ? (
                    <div className="space-y-1.5 rounded-sm border border-primary/50 bg-primary/5 p-2.5 text-xs">
                      {issues.map((issue, index) => (
                        <p key={`${issue.message}-${index}`} className="flex gap-1.5 leading-relaxed">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span>{issue.message}</span>
                        </p>
                      ))}
                    </div>
                  ) : null;
                })()}
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogicEnabled(false)}>
                  Remove logic
                </Button>
              </div>
            )}
          </Section>
        ) : null}

        <div className="flex items-center justify-between border-y border-dashed border-border py-3">
          <Label htmlFor="field-required" className="cursor-pointer">
            Required
          </Label>
          <Switch id="field-required" checked={required} onCheckedChange={setRequired} />
        </div>
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
          allFields={props.allFields}
          logicAvailableForLayout={props.form?.submissionLayout !== "ALL_AT_ONCE"}
          mode={mode}
          position={props.position}
          saving={props.saving}
          onSave={props.onSave}
          onDelete={props.onDelete}
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
