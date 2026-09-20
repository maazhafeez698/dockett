// apps/web/app/dashboard/forms/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  GripVertical,
  Trash2,
  Eye,
  Pencil,
  Type,
  AlignLeft,
  Hash,
  Mail,
  ToggleLeft,
  KeyRound,
  ChevronDown,
  CheckSquare,
  ListChecks,
  Calendar,
  Star,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  useCreateField,
  useDeleteField,
  useGetFields,
  useReorderFields,
  useUpdateField,
} from "~/hooks/api/form-field";
import { useDeleteForm, useGetFormWithFields, useUpdateForm } from "~/hooks/api/form";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { ThemePicker } from "~/components/theme-picker";
import { ThemeToggle } from "~/components/theme-toggle";
import { getFormTheme } from "~/lib/form-themes";

type FieldType =
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

const PALETTE: { type: FieldType; label: string; icon: typeof Type }[] = [
  { type: "TEXT", label: "Short Text", icon: Type },
  { type: "LONG_TEXT", label: "Long Text", icon: AlignLeft },
  { type: "EMAIL", label: "Email", icon: Mail },
  { type: "NUMBER", label: "Number", icon: Hash },
  { type: "YES_NO", label: "Yes / No", icon: ToggleLeft },
  { type: "PASSWORD", label: "Password", icon: KeyRound },
  { type: "DROPDOWN", label: "Dropdown", icon: ChevronDown },
  { type: "MULTI_SELECT", label: "Multi-select", icon: ListChecks },
  { type: "CHECKBOX_GROUP", label: "Checkbox group", icon: CheckSquare },
  { type: "DATE", label: "Date", icon: Calendar },
  { type: "RATING", label: "Rating", icon: Star },
];

const FIELD_TYPE_LABELS: Record<FieldType, string> = Object.fromEntries(
  PALETTE.map((p) => [p.type, p.label]),
) as Record<FieldType, string>;

const OPTION_TYPES = new Set<FieldType>(["DROPDOWN", "MULTI_SELECT", "CHECKBOX_GROUP"]);

interface FieldConfig {
  options?: string[];
  maxLength?: number;
  max?: number;
}

type FieldRow = NonNullable<ReturnType<typeof useGetFields>["fields"]>[number];

function SortableFieldCard({
  field: f,
  selected,
  onSelect,
  previewMode,
  previewValue,
  onPreviewChange,
  accent,
}: {
  field: FieldRow;
  selected: boolean;
  onSelect: () => void;
  previewMode: boolean;
  previewValue: string;
  onPreviewChange: (v: string) => void;
  accent: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (previewMode) {
    return (
      <div ref={setNodeRef} style={style} className="glass rounded-2xl p-4">
        <FormFieldRenderer
          field={f}
          value={previewValue}
          onChange={onPreviewChange}
          accent={accent}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`glass flex cursor-pointer items-center gap-3 rounded-2xl p-4 transition-colors ${
        selected ? "ring-2 ring-primary" : "hover:bg-muted/20"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {f.label}
          {f.isRequired ? <span className="ml-1 text-destructive">*</span> : null}
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {f.description || f.placeholder || ""}
        </div>
      </div>

      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        {FIELD_TYPE_LABELS[f.type as FieldType]}
      </span>
    </div>
  );
}

export default function FormBuilder() {
  const params = useParams();
  const router = useRouter();
  const formId = params?.id as string | undefined;

  const { form } = useGetFormWithFields(formId ?? "");
  const { fields, isLoading: fieldsLoading } = useGetFields(formId ?? "");

  const { createFieldAsync } = useCreateField(formId ?? "");
  const { updateFieldAsync, isPending: isSavingField } = useUpdateField(formId ?? "");
  const { deleteFieldAsync } = useDeleteField(formId ?? "");
  const { reorderFieldsAsync } = useReorderFields(formId ?? "");
  const { updateFormAsync, isPending: isSavingForm } = useUpdateForm();
  const { deleteFormAsync } = useDeleteForm();

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  const selectedField = fields?.find((f) => f.id === selectedFieldId) ?? null;

  // --- inspector draft state, synced whenever the selection changes ---
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPlaceholder, setDraftPlaceholder] = useState("");
  const [draftRequired, setDraftRequired] = useState(false);
  const [draftOptions, setDraftOptions] = useState<string[]>([""]);
  const [draftMaxLength, setDraftMaxLength] = useState("");
  const [draftRatingMax, setDraftRatingMax] = useState("5");

  useEffect(() => {
    if (!selectedField) return;
    setDraftLabel(selectedField.label);
    setDraftDescription(selectedField.description ?? "");
    setDraftPlaceholder(selectedField.placeholder ?? "");
    setDraftRequired(selectedField.isRequired);
    const cfg = (selectedField.config ?? {}) as FieldConfig;
    setDraftOptions(cfg.options && cfg.options.length > 0 ? cfg.options : [""]);
    setDraftMaxLength(cfg.maxLength ? String(cfg.maxLength) : "");
    setDraftRatingMax(cfg.max ? String(cfg.max) : "5");
  }, [selectedField?.id]);

  const handleAddField = async (type: FieldType) => {
    if (!formId) return;
    try {
      const created = await createFieldAsync({ label: FIELD_TYPE_LABELS[type], type, formId });
      setSelectedFieldId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add field");
    }
  };

  const buildConfig = (type: FieldType): FieldConfig | undefined => {
    if (OPTION_TYPES.has(type))
      return { options: draftOptions.map((o) => o.trim()).filter(Boolean) };
    if (type === "LONG_TEXT" && draftMaxLength.trim()) return { maxLength: Number(draftMaxLength) };
    if (type === "RATING") return { max: draftRatingMax.trim() ? Number(draftRatingMax) : 5 };
    return undefined;
  };

  const handleSaveField = async () => {
    if (!selectedField) return;
    try {
      await updateFieldAsync({
        fieldId: selectedField.id,
        label: draftLabel.trim(),
        description: draftDescription.trim() ? draftDescription.trim() : null,
        placeholder: draftPlaceholder.trim() ? draftPlaceholder.trim() : null,
        isRequired: draftRequired,
        config: buildConfig(selectedField.type as FieldType),
      });
      toast.success("Field updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update field");
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!fields || !formId || !over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(fields, oldIndex, newIndex);
    try {
      await reorderFieldsAsync({ formId, orderedFieldIds: reordered.map((f) => f.id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder fields");
    }
  };

  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    if (form) setTitleDraft(form.title);
  }, [form?.title]);

  const handleTitleBlur = async () => {
    if (!formId || !form || titleDraft.trim() === form.title) return;
    try {
      await updateFormAsync({ formId, title: titleDraft.trim() || "Untitled Form" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename form");
    }
  };

  const handleThemeChange = async (themeKey: string) => {
    if (!formId) return;
    try {
      await updateFormAsync({
        formId,
        theme: themeKey as "MIDNIGHT" | "CORAL" | "MINT" | "LAVENDER" | "OCEAN",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update theme");
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

  const theme = getFormTheme(form?.theme);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* --- top toolbar --- */}
      <header className="glass-flat flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <Link href="/dashboard/forms" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>

        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleTitleBlur}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none sm:flex-none sm:w-64"
        />

        <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
          {form?.status ?? "..."}
        </span>

        <div className="flex-1" />

        <Button
          variant={previewMode ? "default" : "outline"}
          size="sm"
          onClick={() => setPreviewMode((v) => !v)}
        >
          <Eye className="mr-1.5 size-3.5" />
          Preview
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteForm}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>

        <ThemeToggle />
      </header>

      {/* --- three panes --- */}
      <div className="grid flex-1 grid-cols-[72px_1fr] overflow-hidden lg:grid-cols-[220px_1fr_320px]">
        {/* Field palette */}
        <aside className="glass-flat overflow-y-auto border-r border-border/60 p-3">
          <p className="mb-2 hidden px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">
            Fields
          </p>
          <div className="space-y-1">
            {PALETTE.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleAddField(type)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:px-3"
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden truncate lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            {previewMode && (
              <div
                className="mb-4 overflow-hidden rounded-2xl p-6"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                  color: theme.onGradient,
                }}
              >
                <h2 className="text-xl font-semibold">{form?.title}</h2>
                {form?.description ? (
                  <p className="mt-1 text-sm opacity-80">{form.description}</p>
                ) : null}
              </div>
            )}

            {fieldsLoading ? (
              <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
                Loading fields...
              </div>
            ) : fields && fields.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {fields.map((f) => (
                      <SortableFieldCard
                        key={f.id}
                        field={f}
                        selected={selectedFieldId === f.id}
                        onSelect={() => setSelectedFieldId(f.id)}
                        previewMode={previewMode}
                        previewValue={previewValues[f.id] ?? ""}
                        onPreviewChange={(v) => setPreviewValues((s) => ({ ...s, [f.id]: v }))}
                        accent={theme.accent}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
                Click a field type on the left to add your first field.
              </div>
            )}
          </div>
        </main>

        {/* Inspector */}
        <aside className="glass-flat hidden overflow-y-auto border-l border-border/60 p-5 xl:block">
          {selectedField ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {FIELD_TYPE_LABELS[selectedField.type as FieldType]}
                </h3>
                <button
                  type="button"
                  onClick={() => handleDeleteField(selectedField.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete field"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Label</label>
                <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Description</label>
                <Textarea
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {!OPTION_TYPES.has(selectedField.type as FieldType) &&
              selectedField.type !== "YES_NO" ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Placeholder</label>
                  <Input
                    value={draftPlaceholder}
                    onChange={(e) => setDraftPlaceholder(e.target.value)}
                  />
                </div>
              ) : null}

              {OPTION_TYPES.has(selectedField.type as FieldType) ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Options</label>
                  <div className="space-y-2">
                    {draftOptions.map((opt, i) => (
                      <div key={i} className="flex gap-1.5">
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const next = [...draftOptions];
                            next[i] = e.target.value;
                            setDraftOptions(next);
                          }}
                          placeholder={`Option ${i + 1}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setDraftOptions(draftOptions.filter((_, idx) => idx !== i))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraftOptions([...draftOptions, ""])}
                    >
                      Add option
                    </Button>
                  </div>
                </div>
              ) : null}

              {selectedField.type === "LONG_TEXT" ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Max length (optional)</label>
                  <Input
                    type="number"
                    value={draftMaxLength}
                    onChange={(e) => setDraftMaxLength(e.target.value)}
                  />
                </div>
              ) : null}

              {selectedField.type === "RATING" ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Scale (2-10)</label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={draftRatingMax}
                    onChange={(e) => setDraftRatingMax(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  checked={draftRequired}
                  onCheckedChange={(v) => setDraftRequired(Boolean(v))}
                />
                <span className="text-sm text-muted-foreground">Required</span>
              </div>

              <Button
                className="w-full"
                onClick={handleSaveField}
                disabled={isSavingField || !draftLabel.trim()}
              >
                {isSavingField ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Pencil className="size-3.5" />
                  Form details
                </h3>
                <p className="text-xs text-muted-foreground">
                  No field selected — editing the form itself.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Description</label>
                <Textarea
                  defaultValue={form?.description ?? ""}
                  rows={3}
                  onBlur={(e) => {
                    if (!formId || e.target.value === (form?.description ?? "")) return;
                    updateFormAsync({
                      formId,
                      description: e.target.value.trim() ? e.target.value.trim() : null,
                    }).catch(() => toast.error("Failed to update description"));
                  }}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-muted-foreground">Theme</label>
                <ThemePicker value={form?.theme ?? "MIDNIGHT"} onChange={handleThemeChange} />
              </div>

              {isSavingForm ? <p className="text-xs text-muted-foreground">Saving...</p> : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
