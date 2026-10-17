"use client";

import { useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { AiDraft, AiDraftField } from "~/lib/ai-stream";
import { DraftEditor } from "./draft-editor";
import { LAYOUT_LABEL, TEMPLATE_LABEL, TYPE_LABEL } from "./shared";

export function FieldRow({ field, dim }: { field: AiDraftField; dim?: boolean }) {
  return (
    <li
      className={`flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm ${dim ? "opacity-70" : ""}`}
    >
      <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {TYPE_LABEL[field.type] ?? field.type}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">
          {field.label}
          {field.isRequired ? <span className="text-destructive"> *</span> : null}
        </span>
        {field.config?.options?.length ? (
          <span className="block break-words text-xs text-muted-foreground">
            {field.config.options.join(" · ")}
          </span>
        ) : null}
        {field.type === "RATING" ? (
          <span className="block text-xs text-muted-foreground">
            Scale 1 – {field.config?.max ?? 5}
          </span>
        ) : null}
        {field.type === "FILE_UPLOAD" ? (
          <span className="block break-words text-xs text-muted-foreground">
            {(field.config?.accept ?? ["pdf", "docx", "jpg", "png"])
              .map((kind) => (kind === "jpg" ? "JPEG" : kind.toUpperCase()))
              .join(", ")}
            {" · "}
            {field.config?.maxFiles ?? 1} file{(field.config?.maxFiles ?? 1) === 1 ? "" : "s"}, up
            to {field.config?.maxSizeMB ?? 5} MB each
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** Streaming preview: fields appear as the model finishes them. No actions until it's done. */
export function LiveDraftPreview({ fields }: { fields: AiDraftField[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-md border border-border/70 bg-card/40 p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Drafting your form… {fields.length} field{fields.length === 1 ? "" : "s"} so far
      </p>
      <ul className="space-y-1.5">
        {fields.map((f, i) => (
          <FieldRow key={`${i}-${f.label}`} field={f} dim />
        ))}
      </ul>
    </div>
  );
}

interface DraftCardProps {
  draft: AiDraft;
  /** Adding to a canvas that already has fields → only the new fields matter. */
  additionsOnly: boolean;
  maxFields: number;
  approved: boolean;
  /** True for the latest draft only; older cards are history. */
  interactive: boolean;
  busy: boolean;
  approveLabel: string;
  onApprove(): void;
  onSave(draft: AiDraft): void;
}

export function DraftCard({
  draft,
  additionsOnly,
  maxFields,
  approved,
  interactive,
  busy,
  approveLabel,
  onApprove,
  onSave,
}: DraftCardProps) {
  const [editing, setEditing] = useState(false);
  const n = draft.fields.length;

  return (
    <div
      className={`rounded-md border bg-card/50 p-3 ${approved ? "border-success/50" : "border-border/70"}`}
    >
      {editing ? (
        <DraftEditor
          draft={draft}
          showFormMeta={!additionsOnly}
          maxFields={maxFields}
          onCancel={() => setEditing(false)}
          onSave={(d) => {
            onSave(d);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="mb-2">
            <p className="break-words text-sm font-semibold">
              {additionsOnly ? `${n} new field${n === 1 ? "" : "s"} for your form` : draft.title}
            </p>
            {!additionsOnly && draft.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{draft.description}</p>
            ) : null}
            {!additionsOnly ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded-[3px] bg-muted px-2 py-0.5">
                  {TEMPLATE_LABEL[draft.template] ?? draft.template}
                </span>
                <span className="rounded-[3px] bg-muted px-2 py-0.5">
                  {LAYOUT_LABEL[draft.submissionLayout]}
                </span>
                <span className="rounded-[3px] bg-muted px-2 py-0.5">
                  {n} field{n === 1 ? "" : "s"}
                </span>
              </div>
            ) : null}
          </div>

          <ul className="space-y-1.5">
            {draft.fields.map((f, i) => (
              <FieldRow key={`${i}-${f.label}`} field={f} />
            ))}
          </ul>

          {approved ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <Check className="size-3.5" /> Added to your canvas
            </p>
          ) : interactive ? (
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={onApprove}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 size-3.5" />
                )}
                {approveLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setEditing(true)}
                disabled={busy}
              >
                <Pencil className="mr-1.5 size-3.5" /> Modify
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Earlier draft — see the latest below.
            </p>
          )}
        </>
      )}
    </div>
  );
}
