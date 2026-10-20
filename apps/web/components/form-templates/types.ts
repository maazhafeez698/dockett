// apps/web/components/form-templates/types.ts
//
// Shared contract every template shell implements. The parent page (public
// fill page or the builder's live preview) owns *all* state — values,
// which field(s) are currently visible, step position, submit handling —
// and just hands a shell the slice it should render. A shell's only job is
// visual: it decides the chrome, typography, spacing, and field
// presentation around the shared <FormFieldRenderer/> inputs. This keeps
// the one-at-a-time vs. all-at-once behavior identical and bug-free across
// every template instead of each shell re-implementing stepping logic.

import type { RendererField } from "~/components/form-field-renderer";

export type SubmissionLayout = "ONE_AT_A_TIME" | "ALL_AT_ONCE";

export interface FormTemplateShellProps {
  title: string;
  description?: string | null;
  /** The full field list — used for progress counts, not necessarily all rendered. */
  fields: RendererField[];
  /** What to actually render this pass — one field (ONE_AT_A_TIME) or all of them. */
  visibleFields: RendererField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  missingFieldIds: Set<string>;
  layout: SubmissionLayout;
  stepIndex: number;
  stepCount: number;
  stepStartIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  onNext: () => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitted: boolean;
  errorMessage?: string | null;
  /** True inside the gallery's Preview modal / the builder's preview pane —
   * disables real navigation side effects that don't make sense there. */
  isPreview?: boolean;
}
