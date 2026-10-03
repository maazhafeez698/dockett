import { z } from "zod";

/**
 * The form "draft" — what the AI proposes and what the user reviews before
 * anything touches the database.
 *
 * Two shapes exist on purpose:
 *  - the *model-facing* shape (`MODEL_OUTPUT_JSON_SCHEMA`, flat, every key
 *    required, "none" expressed as "" / [] / 0). That is the most portable
 *    thing to hand a provider's structured-output feature — no unions, no
 *    nullables, so it is the most portable thing to hand a provider.
 *  - the *app-facing* shape (`FormDraft`), which matches what the existing
 *    createFormFromTemplate / form_fields code already consumes.
 * `normalizeModelOutput` is the only bridge, and it is deliberately lenient
 * about cosmetics but strict about anything that could break the database.
 */

// PASSWORD is intentionally absent: Phase 4 retired it as a question type, so
// the AI must never produce one.
export const AI_FIELD_TYPES = [
  "TEXT",
  "EMAIL",
  "NUMBER",
  "YES_NO",
  "LONG_TEXT",
  "DROPDOWN",
  "MULTI_SELECT",
  "CHECKBOX_GROUP",
  "DATE",
  "RATING",
] as const;
export type AiFieldType = (typeof AI_FIELD_TYPES)[number];

export const AI_TEMPLATES = [
  "CORPORATE",
  "SURVEY",
  "EDUCATION",
  "DEVELOPER",
  "RETRO",
  "INVITATION",
  "TICKET",
  "LANDING",
  "CLASSIC",
] as const;
export type AiTemplate = (typeof AI_TEMPLATES)[number];

export const AI_LAYOUTS = ["ONE_AT_A_TIME", "ALL_AT_ONCE"] as const;
export type AiLayout = (typeof AI_LAYOUTS)[number];

const OPTION_TYPES = new Set<string>(["DROPDOWN", "MULTI_SELECT", "CHECKBOX_GROUP"]);
const PLACEHOLDER_TYPES = new Set<string>(["TEXT", "EMAIL", "NUMBER", "LONG_TEXT"]);

/**
 * What the model says the user's message is. This is the server-enforced
 * scope gate: only BUILD may carry fields; every other intent is reply-only
 * and hard-capped in length, so the model can't be turned into a general
 * chatbot even if a prompt talks it into trying.
 */
export const AI_INTENTS = ["BUILD", "CLARIFY", "CHAT", "OFF_TOPIC"] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

export const LIMITS = {
  title: 50, // forms.title is varchar(50)
  description: 300, // forms.decription is varchar(300)
  label: 100, // form_fields.label is varchar(100)
  fieldDescription: 300,
  placeholder: 120,
  option: 200,
  maxOptions: 20,
  /** Reply cap when a form is being built. */
  reply: 420,
  /** Reply cap for everything else (greetings, questions, redirects) — a nudge, never an answer. */
  replyOther: 280,
} as const;

/** Shortens text to `max` chars, preferring a sentence / word boundary. */
export function clipReply(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1).trim();
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

// ---- app-facing schemas (used to validate anything a client sends back) ----

export const draftFieldSchema = z.object({
  label: z.string().trim().min(1).max(LIMITS.label),
  type: z.enum(AI_FIELD_TYPES),
  description: z.string().trim().max(LIMITS.fieldDescription).optional(),
  placeholder: z.string().trim().max(LIMITS.placeholder).optional(),
  isRequired: z.boolean().default(false),
  config: z
    .object({
      options: z.array(z.string().trim().min(1).max(LIMITS.option)).min(1).max(LIMITS.maxOptions).optional(),
      maxLength: z.number().int().positive().max(5000).optional(),
      max: z.number().int().min(2).max(10).optional(),
    })
    .nullable()
    .optional(),
});
export type DraftField = z.infer<typeof draftFieldSchema>;

export const formDraftSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional(),
  template: z.enum(AI_TEMPLATES).default("CLASSIC"),
  submissionLayout: z.enum(AI_LAYOUTS).default("ONE_AT_A_TIME"),
  fields: z.array(draftFieldSchema).min(1).max(100),
});
export type FormDraft = z.infer<typeof formDraftSchema>;

/**
 * Per-type rules the zod shape can't express. Used both when the AI output is
 * normalised and again on the server when a client asks to save a draft —
 * a client-supplied draft is never trusted just because it came from us.
 */
export function assertDraftConsistent(draft: FormDraft, maxFields: number): void {
  if (draft.fields.length > maxFields) {
    throw new Error(`A form can have at most ${maxFields} fields here`);
  }
  for (const f of draft.fields) {
    if (OPTION_TYPES.has(f.type) && !(f.config?.options && f.config.options.length >= 1)) {
      throw new Error(`"${f.label}" needs at least one option`);
    }
  }
}

// ---- model-facing schema ----

const rawFieldSchema = z.object({
  label: z.string(),
  type: z.string(),
  description: z.string().default(""),
  placeholder: z.string().default(""),
  isRequired: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  ratingMax: z.number().default(0),
  maxLength: z.number().default(0),
});
export type RawField = z.infer<typeof rawFieldSchema>;

const rawOutputSchema = z.object({
  intent: z.string().default(""),
  reply: z.string().default(""),
  form: z
    .object({
      title: z.string().default(""),
      description: z.string().default(""),
      template: z.string().default("CLASSIC"),
      submissionLayout: z.string().default("ONE_AT_A_TIME"),
      fields: z.array(z.unknown()).default([]),
    })
    .default({ title: "", description: "", template: "CLASSIC", submissionLayout: "ONE_AT_A_TIME", fields: [] }),
});

/** JSON Schema handed to providers. Property order matters: `reply` first so it streams first. */
export const MODEL_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "reply", "form"],
  properties: {
    intent: {
      type: "string",
      enum: [...AI_INTENTS],
      description:
        "BUILD = the user wants a form created or changed. CLARIFY = a form request too vague to build, or a question about the form being built. CHAT = greeting / thanks / small talk. OFF_TOPIC = anything not about building a form. Output this first.",
    },
    reply: {
      type: "string",
      description:
        "Short, friendly message to the user (max ~3 sentences). Always present, even when no form is produced.",
    },
    form: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "template", "submissionLayout", "fields"],
      properties: {
        title: { type: "string", description: `Form title, at most ${LIMITS.title} characters. Empty if no form.` },
        description: { type: "string", description: `One-line description, at most ${LIMITS.description} characters. May be empty.` },
        template: { type: "string", enum: [...AI_TEMPLATES], description: "Visual template that best fits the purpose." },
        submissionLayout: { type: "string", enum: [...AI_LAYOUTS], description: "ONE_AT_A_TIME suits short/personal forms; ALL_AT_ONCE suits long or reference-heavy ones." },
        fields: {
          type: "array",
          description: "Ordered form fields. EMPTY array when you are not creating or changing a form.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "type", "description", "placeholder", "isRequired", "options", "ratingMax", "maxLength"],
            properties: {
              label: { type: "string", description: `The question, at most ${LIMITS.label} characters.` },
              type: { type: "string", enum: [...AI_FIELD_TYPES] },
              description: { type: "string", description: "Optional helper text. Empty string if none." },
              placeholder: { type: "string", description: "Optional example text (TEXT/EMAIL/NUMBER/LONG_TEXT only). Empty string if none." },
              isRequired: { type: "boolean" },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Choices for DROPDOWN / MULTI_SELECT / CHECKBOX_GROUP (2-12 items). Empty array for other types.",
              },
              ratingMax: { type: "integer", description: "RATING only: scale size 3-10 (usually 5). 0 for other types." },
              maxLength: { type: "integer", description: "LONG_TEXT only: character cap, or 0 for none." },
            },
          },
        },
      },
    },
  },
} as const;

// ---- normalisation ----

export function toLabelKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Strips control chars and anything that could be interpreted as markup by a careless renderer. */
function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[<>]/g, "");
}

/**
 * Turn one raw model field into a valid DraftField, or null if it can't be
 * salvaged. Never throws.
 */
export function normalizeRawField(input: unknown): DraftField | null {
  const parsed = rawFieldSchema.safeParse(input);
  if (!parsed.success) return null;
  const r = parsed.data;

  const label = clip(cleanText(r.label), LIMITS.label);
  if (!label) return null;

  const type = r.type.trim().toUpperCase();
  if (!(AI_FIELD_TYPES as readonly string[]).includes(type)) return null;
  const t = type as AiFieldType;

  const field: DraftField = { label, type: t, isRequired: r.isRequired === true };

  const description = clip(cleanText(r.description), LIMITS.fieldDescription);
  if (description) field.description = description;

  if (PLACEHOLDER_TYPES.has(t)) {
    const placeholder = clip(cleanText(r.placeholder), LIMITS.placeholder);
    if (placeholder) field.placeholder = placeholder;
  }

  if (OPTION_TYPES.has(t)) {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const raw of r.options) {
      const o = clip(cleanText(String(raw)), LIMITS.option);
      const k = o.toLowerCase();
      if (!o || seen.has(k)) continue;
      seen.add(k);
      options.push(o);
      if (options.length >= LIMITS.maxOptions) break;
    }
    if (options.length < 2) return null; // a choice field with <2 choices isn't a question
    field.config = { options };
  } else if (t === "RATING") {
    const n = Math.round(Number.isFinite(r.ratingMax) ? r.ratingMax : 0);
    field.config = { max: n >= 3 && n <= 10 ? n : 5 };
  } else if (t === "LONG_TEXT") {
    const n = Math.round(Number.isFinite(r.maxLength) ? r.maxLength : 0);
    if (n > 0) field.config = { maxLength: Math.min(n, 5000) };
  }

  return field;
}

/** Make labels unique (by label-key) within a draft; later duplicates get " 2", " 3"… */
export function dedupeLabels(fields: DraftField[], takenKeys: Iterable<string> = []): DraftField[] {
  const taken = new Set<string>(takenKeys);
  const out: DraftField[] = [];
  for (const f of fields) {
    let label = f.label;
    let key = toLabelKey(label) || "field";
    let n = 2;
    while (taken.has(key)) {
      const suffix = ` ${n}`;
      label = clip(f.label, LIMITS.label - suffix.length) + suffix;
      key = toLabelKey(label) || `field_${n}`;
      n += 1;
    }
    taken.add(key);
    out.push(label === f.label ? f : { ...f, label });
  }
  return out;
}

export interface NormalizedOutput {
  intent: AiIntent;
  reply: string;
  /** null unless intent is BUILD and at least one valid field survived. */
  draft: FormDraft | null;
  droppedFields: number;
}

const FALLBACK_REPLY: Record<Exclude<AiIntent, "BUILD">, string> = {
  CLARIFY: "Tell me a bit more about the form you have in mind — who fills it in, and what do you want to find out?",
  CHAT: "Hey! 👋 Tell me what kind of form you need and I'll sketch it out.",
  OFF_TOPIC: "That one's outside my lane — I only build forms 😄 What kind of form can I make for you?",
};

function toIntent(raw: string, hasFields: boolean): AiIntent {
  const v = raw.trim().toUpperCase();
  if ((AI_INTENTS as readonly string[]).includes(v)) return v as AiIntent;
  return hasFields ? "BUILD" : "CLARIFY";
}

/**
 * Validate + clean the model's full JSON output. Throws Error (caught by the
 * orchestrator and treated as an invalid response) only when the output is
 * structurally unusable.
 */
export function normalizeModelOutput(json: unknown, opts: { maxFields: number }): NormalizedOutput {
  const parsed = rawOutputSchema.safeParse(json);
  if (!parsed.success) throw new Error("Model output did not match the expected structure");

  const form = parsed.data.form;
  let intent = toIntent(parsed.data.intent, form.fields.length > 0);
  const rawReply = cleanText(parsed.data.reply);

  // Scope gate: only BUILD may carry a form. Anything else is reply-only and short.
  if (intent !== "BUILD") {
    const reply = clipReply(rawReply, LIMITS.replyOther) || FALLBACK_REPLY[intent];
    return { intent, reply, draft: null, droppedFields: form.fields.length };
  }

  if (form.fields.length === 0) {
    // Said BUILD but built nothing — treat as a clarifying question rather than an error.
    intent = "CLARIFY";
    return { intent, reply: clipReply(rawReply, LIMITS.replyOther) || FALLBACK_REPLY.CLARIFY, draft: null, droppedFields: 0 };
  }

  const cleaned: DraftField[] = [];
  let dropped = 0;
  for (const raw of form.fields.slice(0, opts.maxFields)) {
    const f = normalizeRawField(raw);
    if (f) cleaned.push(f);
    else dropped += 1;
  }
  dropped += Math.max(0, form.fields.length - opts.maxFields);

  if (cleaned.length === 0) throw new Error("Model returned a form with no usable fields");

  const template = String(form.template).trim().toUpperCase();
  const layout = String(form.submissionLayout).trim().toUpperCase();

  const draft: FormDraft = {
    title: clip(cleanText(form.title), LIMITS.title) || "Untitled Form",
    template: (AI_TEMPLATES as readonly string[]).includes(template) ? (template as AiTemplate) : "CLASSIC",
    submissionLayout: (AI_LAYOUTS as readonly string[]).includes(layout) ? (layout as AiLayout) : "ONE_AT_A_TIME",
    fields: dedupeLabels(cleaned),
  };
  const description = clip(cleanText(form.description), LIMITS.description);
  if (description) draft.description = description;

  // Final safety net: what we return must satisfy the same schema the save endpoints enforce.
  const check = formDraftSchema.safeParse(draft);
  if (!check.success) throw new Error("Normalised draft failed validation");
  assertDraftConsistent(check.data, opts.maxFields);

  return {
    intent,
    reply: clipReply(rawReply, LIMITS.reply) || "Here's a draft — have a look and tell me what to tweak!",
    draft: check.data,
    droppedFields: dropped,
  };
}

/** Extract the JSON object from model text, tolerating stray code fences / prefix text. */
export function parseModelJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("Model output contained no JSON object");
  return JSON.parse(t.slice(first, last + 1));
}
