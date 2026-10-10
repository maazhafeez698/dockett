"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { AiDraft, AiDraftField, AiFieldType } from "~/lib/ai-stream";
import { FIELD_TYPES, OPTION_TYPES, PLACEHOLDER_TYPES, TYPE_LABEL, cleanDraft, retypeField, validateDraft } from "./shared";

const inputCls =
  "w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60";
const errCls = "mt-1 text-[11px] text-destructive";

interface DraftEditorProps {
  draft: AiDraft;
  /** Title/description only matter when the draft becomes a whole form (not "additions" to a canvas). */
  showFormMeta: boolean;
  maxFields: number;
  onSave(draft: AiDraft): void;
  onCancel(): void;
}

/**
 * Edits a COPY of the draft. Save hands the copy back; Cancel just discards it,
 * so the structure in the chat is untouched and returns to its original state.
 */
export function DraftEditor({ draft, showFormMeta, maxFields, onSave, onCancel }: DraftEditorProps) {
  const [work, setWork] = useState<AiDraft>(() => structuredClone(draft));
  const errors = useMemo(() => validateDraft(work, showFormMeta), [work, showFormMeta]);

  const patchField = (i: number, patch: Partial<AiDraftField>) =>
    setWork((w) => ({ ...w, fields: w.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) }));
  const setOptions = (i: number, options: string[]) => patchField(i, { config: { ...work.fields[i]!.config, options } });
  const move = (i: number, dir: -1 | 1) =>
    setWork((w) => {
      const j = i + dir;
      if (j < 0 || j >= w.fields.length) return w;
      const fields = [...w.fields];
      [fields[i], fields[j]] = [fields[j]!, fields[i]!];
      return { ...w, fields };
    });
  const remove = (i: number) => setWork((w) => ({ ...w, fields: w.fields.filter((_, idx) => idx !== i) }));
  const add = () =>
    setWork((w) => ({
      ...w,
      fields: [...w.fields, { label: `Question ${w.fields.length + 1}`, type: "TEXT", isRequired: false }],
    }));

  return (
    <div className="space-y-3">
      {showFormMeta ? (
        <div className="space-y-2 rounded-[3px] border border-border/60 bg-background/30 p-3">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Form title
            <input
              value={work.title}
              maxLength={50}
              onChange={(e) => setWork({ ...work, title: e.target.value })}
              className={`${inputCls} mt-1 text-sm normal-case tracking-normal text-foreground`}
            />
          </label>
          {errors.title ? <p className={errCls}>{errors.title}</p> : null}
          <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Description
            <textarea
              value={work.description ?? ""}
              maxLength={300}
              rows={2}
              onChange={(e) => setWork({ ...work, description: e.target.value })}
              className={`${inputCls} mt-1 resize-none normal-case tracking-normal text-foreground`}
            />
          </label>
        </div>
      ) : null}

      <ul className="space-y-2">
        {work.fields.map((f, i) => {
          const fe = errors.perField[i];
          return (
            <li key={i} className="space-y-2 rounded-[3px] border border-border/60 bg-background/30 p-3">
              <div className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1">
                  <input
                    value={f.label}
                    maxLength={100}
                    aria-label={`Label for field ${i + 1}`}
                    onChange={(e) => patchField(i, { label: e.target.value })}
                    className={`${inputCls} font-medium`}
                    placeholder="Question"
                  />
                  {fe?.label ? <p className={errCls}>{fe.label}</p> : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === work.fields.length - 1} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(i)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive" aria-label="Delete field">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={f.type}
                  aria-label={`Type for field ${i + 1}`}
                  onChange={(e) => setWork((w) => ({ ...w, fields: w.fields.map((x, idx) => (idx === i ? retypeField(x, e.target.value as AiFieldType) : x)) }))}
                  className={`${inputCls} flex-1`}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={f.isRequired} onChange={(e) => patchField(i, { isRequired: e.target.checked })} className="size-3.5 accent-[var(--primary)]" />
                  Required
                </label>
              </div>

              <input
                value={f.description ?? ""}
                maxLength={300}
                onChange={(e) => patchField(i, { description: e.target.value })}
                className={inputCls}
                placeholder="Helper text (optional)"
              />
              {PLACEHOLDER_TYPES.has(f.type) ? (
                <input
                  value={f.placeholder ?? ""}
                  maxLength={120}
                  onChange={(e) => patchField(i, { placeholder: e.target.value })}
                  className={inputCls}
                  placeholder="Placeholder (optional)"
                />
              ) : null}

              {f.type === "RATING" ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Scale
                  <select value={f.config?.max ?? 5} onChange={(e) => patchField(i, { config: { max: Number(e.target.value) } })} className={`${inputCls} w-24`}>
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        1 – {n}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {OPTION_TYPES.has(f.type) ? (
                <div className="space-y-1.5">
                  {(f.config?.options ?? []).map((o, oi) => (
                    <div key={oi} className="flex items-center gap-1.5">
                      <input
                        value={o}
                        maxLength={200}
                        aria-label={`Option ${oi + 1} of field ${i + 1}`}
                        onChange={(e) => setOptions(i, (f.config?.options ?? []).map((x, xi) => (xi === oi ? e.target.value : x)))}
                        className={inputCls}
                      />
                      <button type="button" onClick={() => setOptions(i, (f.config?.options ?? []).filter((_, xi) => xi !== oi))} className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remove option">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {fe?.options ? <p className={errCls}>{fe.options}</p> : null}
                  {(f.config?.options?.length ?? 0) < 20 ? (
                    <button type="button" onClick={() => setOptions(i, [...(f.config?.options ?? []), `Option ${(f.config?.options?.length ?? 0) + 1}`])} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Plus className="size-3" /> Add option
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {errors.fields ? <p className={errCls}>{errors.fields}</p> : null}
      {work.fields.length < maxFields ? (
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="size-3.5" /> Add field
        </button>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!errors.valid} onClick={() => onSave(cleanDraft(work))}>
          Save
        </Button>
      </div>
    </div>
  );
}
