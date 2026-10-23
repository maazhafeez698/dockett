// packages/services/form-submission/validate.ts
//
// Validates a response against the EXACT published version it was submitted to (the snapshot's
// fields), not against whatever the draft looks like now. Pure and synchronous, so it is easy to
// test. FILE_UPLOAD answers are resolved separately (they reference verified uploads).

import type { FormSnapshotField } from "@repo/database/models/form-version";
import { analyzeConditionalLogic, calculateActivePath } from "@repo/services/form-logic";
import { numberProblem } from "./number-rules";

export interface AnswerInput {
  fieldId: string;
  value: string;
}

interface Cfg {
  options?: string[];
  maxLength?: number;
  max?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
}

const MAX_ANSWER_LENGTH = 20_000;
const SHORT_TEXT_LENGTH = 2_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Is `value` exactly a "," joined list of DISTINCT options? (Options may themselves contain commas.) */
function isOptionList(value: string, options: string[]): boolean {
  const set = new Set(options);
  const memo = new Map<string, boolean>();
  const walk = (rest: string, used: Set<string>): boolean => {
    if (rest === "") return true;
    const key = `${rest}|${[...used].sort().join("\u0000")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let ok = false;
    for (const opt of set) {
      if (used.has(opt)) continue;
      if (rest === opt) ok = true;
      else if (rest.startsWith(opt + ",")) ok = walk(rest.slice(opt.length + 1), new Set(used).add(opt));
      if (ok) break;
    }
    memo.set(key, ok);
    return ok;
  };
  return walk(value, new Set());
}

/**
 * Returns the answer for every field of the version (empty string when not answered) or throws a
 * respondent-readable Error. FILE_UPLOAD fields are passed through untouched (and `required` is
 * checked for them by the caller after the files are resolved).
 */
export function validateAnswers(fields: FormSnapshotField[], values: AnswerInput[]): Map<string, string> {
  const logicErrors = analyzeConditionalLogic(fields).errors;
  if (logicErrors.length > 0) throw new Error(`This form has invalid question logic: ${logicErrors[0]!.message}`);

  const known = new Map(fields.map((f) => [f.id, f]));
  const given = new Map<string, string>();
  for (const v of values) {
    if (!known.has(v.fieldId)) throw new Error("This response doesn't match the form. Reload the page and try again.");
    if (given.has(v.fieldId)) throw new Error("Invalid response: a field was answered twice.");
    if (v.value.length > MAX_ANSWER_LENGTH) throw new Error("One of your answers is too long.");
    given.set(v.fieldId, v.value);
  }

  const submittedValues = Object.fromEntries(given);
  const active = new Set(calculateActivePath(fields, submittedValues));
  for (const field of fields) {
    if (!active.has(field.id) && (given.get(field.id) ?? "").trim() !== "") {
      throw new Error(`"${field.label}" isn't part of this response's path. Reload the form and try again.`);
    }
  }

  const missing: string[] = [];
  const out = new Map<string, string>();

  for (const f of fields) {
    const isActive = active.has(f.id);
    const value = isActive ? given.get(f.id) ?? "" : "";
    out.set(f.id, value);
    if (!isActive) continue;
    const cfg = (f.config ?? {}) as Cfg;
    const empty = value.trim() === "";

    if (f.type === "FILE_UPLOAD") continue;
    if (empty) {
      if (f.isRequired) missing.push(f.label);
      continue;
    }

    const fail = (msg: string): never => {
      throw new Error(`"${f.label}": ${msg}`);
    };

    switch (f.type) {
      case "TEXT":
      case "PASSWORD":
        if (value.length > SHORT_TEXT_LENGTH) fail("is too long");
        break;
      case "LONG_TEXT":
        if (cfg.maxLength && value.length > cfg.maxLength) fail(`must be at most ${cfg.maxLength} characters`);
        break;
      case "EMAIL":
        if (value.length > 254 || !EMAIL_RE.test(value.trim())) fail("enter a valid email address");
        break;
      case "NUMBER": {
        const problem = numberProblem(value, cfg);
        if (problem) fail(problem);
        break;
      }
      case "DATE": {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
        const d = m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)) : null;
        if (!m || !d || d.getUTCMonth() !== +m[2]! - 1 || d.getUTCDate() !== +m[3]!) fail("enter a valid date");
        break;
      }
      case "YES_NO":
        if (value !== "true" && value !== "false") fail("choose Yes or No");
        break;
      case "RATING": {
        const n = Number(value);
        const max = cfg.max ?? 5;
        if (!Number.isInteger(n) || n < 1 || n > max) fail(`choose between 1 and ${max} stars`);
        break;
      }
      case "DROPDOWN":
      case "RADIO_GROUP":
        if (!(cfg.options ?? []).includes(value)) fail("choose one of the listed options");
        break;
      case "MULTI_SELECT":
      case "CHECKBOX_GROUP":
        if (!isOptionList(value, cfg.options ?? [])) fail("choose only from the listed options");
        break;
      default:
        break;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      missing.length === 1 ? `"${missing[0]}" is required` : `These fields are required: ${missing.join(", ")}`,
    );
  }
  return out;
}
