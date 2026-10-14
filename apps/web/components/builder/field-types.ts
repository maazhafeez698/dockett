import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Hash,
  ListChecks,
  Mail,
  Star,
  ToggleLeft,
  Type,
  Upload,
} from "lucide-react";

/**
 * The final field list (12). PASSWORD is intentionally not here: it is no longer offered in the
 * builder, but forms that already contain one keep working (see LEGACY_LABELS).
 * DROPDOWN is the stored value of the "Single-select" field.
 */
export type FieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "EMAIL"
  | "NUMBER"
  | "DROPDOWN"
  | "MULTI_SELECT"
  | "DATE"
  | "RADIO_GROUP"
  | "CHECKBOX_GROUP"
  | "RATING"
  | "YES_NO"
  | "FILE_UPLOAD";

export type AcceptedFileKind = "pdf" | "docx" | "jpg" | "png";

export interface FieldConfig {
  options?: string[];
  maxLength?: number;
  /** rating scale (stars) */
  max?: number;
  /** NUMBER */
  minValue?: number;
  maxValue?: number;
  step?: number;
  /** FILE_UPLOAD */
  accept?: AcceptedFileKind[];
  maxFiles?: number;
  maxSizeMB?: number;
}

/** A field as both builder views render it. */
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
  { type: "DROPDOWN", label: "Single-select", short: "Single", icon: ChevronDown },
  { type: "MULTI_SELECT", label: "Multi-select", short: "Multi", icon: ListChecks },
  { type: "DATE", label: "Date", short: "Date", icon: Calendar },
  { type: "RADIO_GROUP", label: "Radio group", short: "Radio", icon: CircleDot },
  { type: "CHECKBOX_GROUP", label: "Checkbox group", short: "Checkbox", icon: CheckSquare },
  { type: "RATING", label: "Rating", short: "Rating", icon: Star },
  { type: "YES_NO", label: "Yes / No", short: "Yes / No", icon: ToggleLeft },
  { type: "FILE_UPLOAD", label: "File upload", short: "File", icon: Upload },
];

/** Types that exist in saved forms but are no longer offered. */
const LEGACY_LABELS: Record<string, string> = { PASSWORD: "Password" };

export const FIELD_TYPE_LABELS: Record<FieldType, string> = Object.fromEntries(
  PALETTE.map((p) => [p.type, p.label]),
) as Record<FieldType, string>;

export const OPTION_TYPES = new Set<FieldType>([
  "DROPDOWN",
  "MULTI_SELECT",
  "CHECKBOX_GROUP",
  "RADIO_GROUP",
]);

export const FIELD_MIME = "application/dockett-field-id";
export const TYPE_MIME = "application/dockett-field-type";

export function typeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type as FieldType] ?? LEGACY_LABELS[type] ?? type;
}

export function getOptions(field: BuilderField): string[] {
  const cfg = (field.config ?? {}) as FieldConfig;
  return Array.isArray(cfg.options) ? cfg.options : [];
}
