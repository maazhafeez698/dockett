// apps/web/components/builder/field-types.ts
//
// Shared by the List view, the Node (canvas) view and the inspector, so both
// views read exactly the same field model.

import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  Hash,
  KeyRound,
  ListChecks,
  Mail,
  Star,
  ToggleLeft,
  Type,
} from "lucide-react";

export type FieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "EMAIL"
  | "YES_NO"
  | "PASSWORD"
  | "DROPDOWN"
  | "MULTI_SELECT"
  | "CHECKBOX_GROUP"
  | "DATE"
  | "RATING";

export interface FieldConfig {
  options?: string[];
  maxLength?: number;
  max?: number;
}

/** The field shape both views render. */
export interface BuilderField {
  id: string;
  label: string;
  description?: string | null;
  placeholder?: string | null;
  isRequired: boolean;
  type: string;
  config?: unknown;
}

export const PALETTE: {
  type: FieldType;
  /** default label for a freshly created field */
  label: string;
  /** short name shown on palette tiles */
  short: string;
  icon: typeof Type;
}[] = [
  { type: "TEXT", label: "Short Text", short: "Short text", icon: Type },
  { type: "LONG_TEXT", label: "Long Text", short: "Long text", icon: AlignLeft },
  { type: "EMAIL", label: "Email", short: "Email", icon: Mail },
  { type: "NUMBER", label: "Number", short: "Number", icon: Hash },
  { type: "YES_NO", label: "Yes / No", short: "Yes / No", icon: ToggleLeft },
  { type: "PASSWORD", label: "Password", short: "Password", icon: KeyRound },
  { type: "DROPDOWN", label: "Dropdown", short: "Dropdown", icon: ChevronDown },
  { type: "MULTI_SELECT", label: "Multi-select", short: "Multi", icon: ListChecks },
  { type: "CHECKBOX_GROUP", label: "Checkbox group", short: "Checkbox", icon: CheckSquare },
  { type: "DATE", label: "Date", short: "Date", icon: Calendar },
  { type: "RATING", label: "Rating", short: "Rating", icon: Star },
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = Object.fromEntries(
  PALETTE.map((p) => [p.type, p.label]),
) as Record<FieldType, string>;

export const OPTION_TYPES = new Set<FieldType>(["DROPDOWN", "MULTI_SELECT", "CHECKBOX_GROUP"]);

export const FIELD_MIME = "application/dockett-field-id";
export const TYPE_MIME = "application/dockett-field-type";

export function typeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type as FieldType] ?? type;
}

export function getOptions(field: BuilderField): string[] {
  const cfg = (field.config ?? {}) as FieldConfig;
  return Array.isArray(cfg.options) ? cfg.options : [];
}
