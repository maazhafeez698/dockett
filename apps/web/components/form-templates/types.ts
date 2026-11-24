import type { RendererField } from "~/components/form-field-renderer";
import type { TemplateCustomization } from "~/lib/template-designs";

export type SubmissionLayout = "ONE_AT_A_TIME" | "ALL_AT_ONCE";

export interface FormTemplateShellProps {
  designSettings?: TemplateCustomization;
  title: string;
  description?: string | null;
  // The full field list — used for progress counts, not necessarily all rendered. 
  fields: RendererField[];
  // What to actually render this pass — one field (ONE_AT_A_TIME) or all of them. 
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
  // True inside the gallery's Preview modal / the builder's preview pane -
  // disables real navigation side effects that don't make sense there. 
  isPreview?: boolean;
}
