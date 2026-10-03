import type { AiDraft, AiDraftField, AiFieldType } from "~/lib/ai-stream";

export const TYPE_LABEL: Record<AiFieldType, string> = {
  TEXT: "Short text",
  LONG_TEXT: "Long text",
  EMAIL: "Email",
  NUMBER: "Number",
  YES_NO: "Yes / No",
  DROPDOWN: "Dropdown",
  MULTI_SELECT: "Multi-select",
  CHECKBOX_GROUP: "Checkboxes",
  DATE: "Date",
  RATING: "Rating",
};

export const FIELD_TYPES = Object.keys(TYPE_LABEL) as AiFieldType[];
export const OPTION_TYPES = new Set<AiFieldType>(["DROPDOWN", "MULTI_SELECT", "CHECKBOX_GROUP"]);
export const PLACEHOLDER_TYPES = new Set<AiFieldType>(["TEXT", "EMAIL", "NUMBER", "LONG_TEXT"]);

export const TEMPLATE_LABEL: Record<string, string> = {
  CORPORATE: "Professional",
  SURVEY: "Survey",
  EDUCATION: "Education",
  DEVELOPER: "Developer",
  RETRO: "Retro",
  INVITATION: "Invitation",
  TICKET: "Ticket",
  LANDING: "Landing",
  CLASSIC: "Classic",
};

export const LAYOUT_LABEL = { ONE_AT_A_TIME: "One question at a time", ALL_AT_ONCE: "All at once" } as const;

/** Changing a field's type must also reset the settings that only make sense for the old type. */
export function retypeField(field: AiDraftField, type: AiFieldType): AiDraftField {
  const next: AiDraftField = { ...field, type };
  if (OPTION_TYPES.has(type)) {
    const keep = field.config?.options?.length ? field.config.options : ["Option 1", "Option 2"];
    next.config = { options: keep };
  } else if (type === "RATING") {
    next.config = { max: field.config?.max ?? 5 };
  } else if (type === "LONG_TEXT" && field.config?.maxLength) {
    next.config = { maxLength: field.config.maxLength };
  } else {
    next.config = null;
  }
  if (!PLACEHOLDER_TYPES.has(type)) delete next.placeholder;
  return next;
}

export interface DraftErrors {
  title?: string;
  fields?: string;
  perField: Record<number, { label?: string; options?: string }>;
  valid: boolean;
}

export function validateDraft(draft: AiDraft, requireTitle: boolean): DraftErrors {
  const out: DraftErrors = { perField: {}, valid: true };
  if (requireTitle && !draft.title.trim()) out.title = "Give your form a title";
  if (draft.fields.length === 0) out.fields = "A form needs at least one field";

  const seen = new Set<string>();
  draft.fields.forEach((f, i) => {
    const errs: { label?: string; options?: string } = {};
    const label = f.label.trim();
    if (!label) errs.label = "Label can't be empty";
    else {
      const key = label.toLowerCase();
      if (seen.has(key)) errs.label = "Another field already has this label";
      seen.add(key);
    }
    if (OPTION_TYPES.has(f.type)) {
      const opts = (f.config?.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) errs.options = "Add at least two options";
      else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) errs.options = "Options must be different";
    }
    if (errs.label || errs.options) out.perField[i] = errs;
  });

  out.valid = !out.title && !out.fields && Object.keys(out.perField).length === 0;
  return out;
}

/** Trim everything and drop empties so what we save is exactly what the server will accept. */
export function cleanDraft(draft: AiDraft): AiDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description?.trim() || undefined,
    fields: draft.fields.map((f) => {
      const out: AiDraftField = { ...f, label: f.label.trim(), isRequired: !!f.isRequired };
      out.description = f.description?.trim() || undefined;
      out.placeholder = PLACEHOLDER_TYPES.has(f.type) ? f.placeholder?.trim() || undefined : undefined;
      if (OPTION_TYPES.has(f.type)) {
        out.config = { options: (f.config?.options ?? []).map((o) => o.trim()).filter(Boolean) };
      }
      return out;
    }),
  };
}

export function formatReset(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "a moment";
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
