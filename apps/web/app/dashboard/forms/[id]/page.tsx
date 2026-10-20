// apps/web/app/dashboard/forms/[id]/page.tsx
//
// The form builder. Two views over the same form data:
//   - List  (default): palette + drag-and-drop list of field cards
//   - Nodes: the canvas flow (START → fields → END)
// Selection, edits, preview and every action are shared, so switching views
// never loses state.

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Eye, Rocket, Share2, Sparkles, Trash2 } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { FieldCanvas, type CanvasField } from "~/components/field-canvas";
import { FieldInspector, type FieldPatch } from "~/components/builder/field-inspector";
import { ListView } from "~/components/builder/list-view";
import {
  FIELD_TYPE_LABELS,
  OPTION_TYPES,
  getOptions,
  typeLabel,
  type BuilderField,
  type FieldType,
} from "~/components/builder/field-types";
import {
  useCreateField,
  useDeleteField,
  useGetFields,
  useReorderFields,
  useUpdateField,
} from "~/hooks/api/form-field";
import { useDeleteForm, useGetFormWithFields, useUpdateForm } from "~/hooks/api/form";
import { useBillingOverview } from "~/hooks/api/billing";
import { useAuthGuard } from "~/hooks/use-auth-guard";
import { useMediaQuery } from "~/hooks/use-media-query";
import { toastError } from "~/lib/plan-limit";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { ShareFormDialog } from "~/components/share-form-dialog";
import { PublishFormDialog } from "~/components/publish-form-dialog";
import { AiFormBuilderPanel } from "~/components/ai-form-builder/panel";
import { FormTemplateRenderer } from "~/components/form-templates";
import { FormUploadProvider } from "~/components/form-upload-context";
import { useSubmissionFlow } from "~/hooks/use-submission-flow";
import type { FormTemplateId } from "~/lib/template-designs";
import { MAX_FIELDS_PER_FORM } from "@repo/services/form-field/limits";

type BuilderView = "list" | "nodes";

/** What a freshly added field starts with. */
function defaultConfig(type: FieldType) {
  if (OPTION_TYPES.has(type)) return { options: ["Option 1"] };
  if (type === "FILE_UPLOAD") return { maxFiles: 1, maxSizeMB: 5 };
  return undefined;
}

export default function FormBuilder() {
  const params = useParams();
  const router = useRouter();
  const { ready } = useAuthGuard();
  const { overview: billing } = useBillingOverview();
  const premiumUnlocked = billing?.plan.premiumTemplates ?? true;
  const [aiOpen, setAiOpen] = useState(false);
  const formId = params?.id as string | undefined;

  const { form } = useGetFormWithFields(formId ?? "");
  const { fields, isLoading: fieldsLoading } = useGetFields(formId ?? "");

  const { createFieldAsync } = useCreateField(formId ?? "");
  const { updateFieldAsync, isPending: isSavingField } = useUpdateField(formId ?? "");
  const { deleteFieldAsync } = useDeleteField(formId ?? "");
  const { reorderFieldsAsync } = useReorderFields(formId ?? "");
  const { updateFormAsync, isPending: isSavingForm } = useUpdateForm();
  const { deleteFormAsync } = useDeleteForm();

  // List is the default view.
  const [view, setView] = useState<BuilderView>("list");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const isWide = useMediaQuery("(min-width: 1280px)");

  const previewFlow = useSubmissionFlow(fields ?? [], form?.submissionLayout ?? "ONE_AT_A_TIME");

  const selectedField = fields?.find((f) => f.id === selectedFieldId) ?? null;
  const selectedIndex = selectedField
    ? (fields ?? []).findIndex((f) => f.id === selectedField.id)
    : -1;

  // a deleted/missing field can't stay selected
  useEffect(() => {
    if (selectedFieldId && fields && !fields.some((f) => f.id === selectedFieldId)) {
      setSelectedFieldId(null);
    }
  }, [fields, selectedFieldId]);

  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    if (form) setTitleDraft(form.title);
  }, [form?.title]);

  /* ----------------------------- actions ----------------------------- */

  const handleAddField = async (type: FieldType) => {
    if (!formId || !fields || fieldsLoading) return;
    if (fields && fields.length >= MAX_FIELDS_PER_FORM) {
      toast.error(
        `A form can have at most ${MAX_FIELDS_PER_FORM} fields. Delete a field to add another.`,
      );
      return;
    }
    try {
      const created = await createFieldAsync({
        label: FIELD_TYPE_LABELS[type],
        type,
        formId,
        config: defaultConfig(type),
      });
      setSelectedFieldId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add field");
    }
  };

  // Dropped onto the list/canvas at a specific position — create it, then
  // reorder if it didn't land at the end (createField always appends).
  const handleDropNewField = async (type: string, afterFieldId: string | undefined) => {
    if (!formId || !fields) return;
    if (fields.length >= MAX_FIELDS_PER_FORM) {
      toast.error(
        `A form can have at most ${MAX_FIELDS_PER_FORM} fields. Delete a field to add another.`,
      );
      return;
    }
    const fieldType = type as FieldType;
    if (!FIELD_TYPE_LABELS[fieldType]) return;

    try {
      const created = await createFieldAsync({
        label: FIELD_TYPE_LABELS[fieldType],
        type: fieldType,
        formId,
        config: defaultConfig(fieldType),
      });
      setSelectedFieldId(created.id);

      const withoutNew = fields.map((f) => f.id);
      const insertAt = afterFieldId ? withoutNew.indexOf(afterFieldId) + 1 : 0;
      const reordered = [
        ...withoutNew.slice(0, insertAt),
        created.id,
        ...withoutNew.slice(insertAt),
      ];

      if (insertAt < withoutNew.length) {
        await reorderFieldsAsync({ formId, orderedFieldIds: reordered });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add field");
    }
  };

  const handleSaveField = async (fieldId: string, patch: FieldPatch) => {
    try {
      await updateFieldAsync({ fieldId, ...patch });
      toast.success(view === "nodes" ? "Node updated" : "Field updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update field");
    }
  };

  const handleRemoveOption = async (fieldId: string, index: number) => {
    const field = fields?.find((f) => f.id === fieldId);
    if (!field) return;
    const options = getOptions(field as BuilderField).filter((_, i) => i !== index);
    try {
      await updateFieldAsync({ fieldId, config: { options } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove option");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Delete this field?")) return;
    try {
      await deleteFieldAsync({ fieldId });
      if (selectedFieldId === fieldId) setSelectedFieldId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete field");
    }
  };

  const handleReorder = async (orderedIds: string[]): Promise<boolean> => {
    if (!formId) return false;
    try {
      await reorderFieldsAsync({ formId, orderedFieldIds: orderedIds });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder fields");
      return false;
    }
  };

  const handleTitleBlur = async () => {
    if (!formId || !form || titleDraft.trim() === form.title) return;
    try {
      await updateFormAsync({ formId, title: titleDraft.trim() || "Untitled Form" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename form");
    }
  };

  const handleDescriptionBlur = (value: string) => {
    if (!formId || value === (form?.description ?? "")) return;
    updateFormAsync({ formId, description: value.trim() ? value.trim() : null }).catch(() =>
      toast.error("Failed to update description"),
    );
  };

  const handleTemplateChange = async (templateId: string) => {
    if (!formId) return;
    try {
      await updateFormAsync({ formId, template: templateId as FormTemplateId });
    } catch (err) {
      toastError(err, "Failed to update template", () => router.push("/dashboard/billing"));
    }
  };

  const handleLayoutChange = async (layout: "ONE_AT_A_TIME" | "ALL_AT_ONCE") => {
    if (!formId) return;
    try {
      await updateFormAsync({ formId, submissionLayout: layout });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update layout");
    }
  };

  const handleDeleteForm = async () => {
    if (!formId) return;
    if (!confirm("Delete this form and all of its fields and submissions? This can't be undone."))
      return;
    try {
      await deleteFormAsync({ formId });
      router.push("/dashboard/forms");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete form");
    }
  };

  const builderFields = (fields ?? []) as BuilderField[];

  const inspector = (
    <FieldInspector
      mode={view}
      field={selectedField as BuilderField | null}
      position={selectedIndex >= 0 ? selectedIndex + 1 : undefined}
      form={form}
      premiumUnlocked={premiumUnlocked}
      saving={isSavingField}
      savingForm={isSavingForm}
      onSave={handleSaveField}
      onDelete={handleDeleteField}
      onDescriptionBlur={handleDescriptionBlur}
      onTemplateChange={handleTemplateChange}
      onLayoutChange={handleLayoutChange}
    />
  );

  if (!ready) return null;

  /* ------------------------------ render ------------------------------ */

  const statusVariant = form?.status === "PUBLISHED" ? "secondary" : "ember";

  return (
    <AppShell docLabel="Create form" scroll={false}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden p-3 sm:px-4 lg:px-5 lg:pt-3 lg:pb-5">
        {/* --- toolbar --- */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2">
          <Link
            href="/dashboard/forms"
            aria-label="Back to forms"
            className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Form title"
            className="font-display min-w-0 max-w-none flex-1 bg-transparent text-lg font-extrabold tracking-[-0.03em] outline-none focus-visible:underline decoration-primary underline-offset-4 sm:max-w-[16rem] sm:flex-none sm:text-xl"
          />

          {form ? <Badge variant={statusVariant}>{form.status}</Badge> : null}

          {/* view switch */}
          <div
            className="flex border border-foreground/70 p-0.5"
            role="group"
            aria-label="Builder view"
          >
            {(
              [
                ["list", "List"],
                ["nodes", "Nodes"],
              ] as const
            ).map(([v, text]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`mono-label-sm rounded-[2px] px-3 py-2 transition-colors ${
                  view === v
                    ? "bg-solid text-solid-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="hidden flex-1 md:block" />

          <div className="flex w-full flex-wrap items-center gap-1.5 md:ml-0 md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiOpen(true)}
              disabled={!formId || fieldsLoading || (fields?.length ?? 0) >= MAX_FIELDS_PER_FORM}
              title={
                (fields?.length ?? 0) >= MAX_FIELDS_PER_FORM
                  ? "Delete a field to make room for AI-generated fields."
                  : undefined
              }
            >
              <Sparkles /> AI Generate
            </Button>

            <Button
              variant={previewMode ? "default" : "outline"}
              size="sm"
              aria-pressed={previewMode}
              onClick={() => setPreviewMode((v) => !v)}
            >
              <Eye /> Preview
            </Button>

            {formId && form ? (
              <ShareFormDialog
                formId={formId}
                submissionAccess={form.submissionAccess}
                accessCode={form.accessCode}
              >
                <Button variant="outline" size="sm">
                  <Share2 /> Share
                </Button>
              </ShareFormDialog>
            ) : null}

            {formId && form ? (
              <PublishFormDialog
                formId={formId}
                currentStatus={form.status}
                currentVisibility={form.visibility}
                currentSubmissionAccess={form.submissionAccess}
                currentAccessCode={form.accessCode}
              >
                <Button size="sm">
                  <Rocket /> Publish
                </Button>
              </PublishFormDialog>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteForm}
              className="border-destructive/60 text-destructive hover:bg-destructive hover:text-white"
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </div>

        {formId ? (
          <AiFormBuilderPanel
            open={aiOpen}
            onOpenChange={setAiOpen}
            mode="ADD_FIELDS"
            formId={formId}
            existingFieldCount={fields?.length ?? 0}
          />
        ) : null}

        {/* --- body --- */}
        {previewMode ? (
          <div className="dotgrid-strong min-h-0 flex-1 overflow-y-auto border border-border bg-card/40 p-4 sm:p-6">
            <div className="mx-auto max-w-2xl">
              {fieldsLoading ? (
                <div className="border border-border bg-card p-6 text-sm text-muted-foreground">
                  Loading fields...
                </div>
              ) : fields && fields.length > 0 ? (
                <FormUploadProvider formId={formId ?? null} isPreview>
                  <FormTemplateRenderer
                    template={form?.template}
                    title={form?.title ?? ""}
                    description={form?.description}
                    fields={fields}
                    visibleFields={previewFlow.visibleFields}
                    values={previewFlow.values}
                    onChange={previewFlow.onChange}
                    missingFieldIds={previewFlow.missingFieldIds}
                    layout={form?.submissionLayout ?? "ONE_AT_A_TIME"}
                    stepIndex={previewFlow.step}
                    stepCount={previewFlow.stepCount}
                    stepStartIndex={previewFlow.stepStartIndex}
                    isFirstStep={previewFlow.isFirstStep}
                    isLastStep={previewFlow.isLastStep}
                    onNext={previewFlow.onNext}
                    onBack={previewFlow.onBack}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (form?.submissionLayout === "ALL_AT_ONCE" && !previewFlow.isLastStep) {
                        previewFlow.onNext();
                        return;
                      }
                      if (!previewFlow.validateAll()) return;
                      toast.info("This is a preview — publish the form to collect real responses.");
                    }}
                    submitting={false}
                    submitted={false}
                    isPreview
                  />
                </FormUploadProvider>
              ) : (
                <div className="border border-dashed border-foreground/40 bg-card p-10 text-center text-sm text-muted-foreground">
                  No fields yet.
                </div>
              )}
            </div>
          </div>
        ) : view === "list" ? (
          <div className="grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-[212px_minmax(0,1fr)] xl:grid-cols-[212px_minmax(0,1fr)_300px]">
            <ListView
              fields={builderFields}
              loading={fieldsLoading}
              selectedFieldId={selectedFieldId}
              onSelect={setSelectedFieldId}
              onAddField={handleAddField}
              onDropNewField={handleDropNewField}
              onReorder={handleReorder}
              onDeleteField={handleDeleteField}
              onRemoveOption={handleRemoveOption}
              onOpenAi={() => setAiOpen(true)}
              onEdit={() => setInspectorOpen(true)}
              formTitle={titleDraft}
              onTitleChange={setTitleDraft}
              onTitleCommit={handleTitleBlur}
              formDescription={form?.description}
              layout={form?.submissionLayout === "ALL_AT_ONCE" ? "ALL_AT_ONCE" : "ONE_AT_A_TIME"}
            />
            {isWide ? (
              <aside className="flex min-h-0 flex-col border border-border bg-card">
                {inspector}
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-0 min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section
              className="relative min-h-[360px] min-w-0 overflow-hidden border border-border bg-card/40"
              aria-label="Form canvas"
            >
              {fieldsLoading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading fields...</div>
              ) : fields ? (
                <FieldCanvas
                  fields={fields.map(
                    (f): CanvasField => ({
                      id: f.id,
                      label: f.label,
                      description: f.description,
                      isRequired: f.isRequired,
                      type: f.type,
                      typeLabel: typeLabel(f.type).toUpperCase(),
                    }),
                  )}
                  selectedFieldId={selectedFieldId}
                  onSelectField={(id) => {
                    setSelectedFieldId(id);
                    if (id && !isWide) setInspectorOpen(true);
                  }}
                  onReorder={handleReorder}
                  onDeleteField={handleDeleteField}
                  onDropNewField={handleDropNewField}
                  onAddField={handleAddField}
                  canAddFields={!fieldsLoading && (fields?.length ?? 0) < MAX_FIELDS_PER_FORM}
                />
              ) : null}
            </section>
            {isWide ? (
              <aside className="flex min-h-0 flex-col border border-border bg-card">
                {inspector}
              </aside>
            ) : null}
          </div>
        )}
      </div>

      {/* inspector as a sheet below the xl breakpoint */}
      {!isWide ? (
        <Sheet open={inspectorOpen && !previewMode} onOpenChange={setInspectorOpen}>
          <SheetContent
            side="bottom"
            className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:mx-auto sm:max-w-lg"
          >
            <SheetTitle className="sr-only">Inspector</SheetTitle>
            {inspector}
          </SheetContent>
        </Sheet>
      ) : null}

      {/* below xl the inspector is reachable from a floating button in both views */}
      {!isWide && !previewMode ? (
        <button
          type="button"
          onClick={() => setInspectorOpen(true)}
          className="mono-label fixed right-4 bottom-4 z-30 md:bottom-24 flex h-10 items-center gap-2 rounded-[3px] bg-solid px-4 text-solid-foreground shadow-[3px_3px_0_0_var(--hard-shadow)]"
        >
          {selectedField ? "Edit field" : "Form settings"}
        </button>
      ) : null}
    </AppShell>
  );
}
