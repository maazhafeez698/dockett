// apps/web/app/dashboard/forms/[id]/page.tsx

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Pencil, Trash2, Eye, Palette } from "lucide-react";

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

import { AppHeader } from "~/components/app-header";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { ThemePicker } from "~/components/theme-picker";
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

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Short text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  EMAIL: "Email",
  YES_NO: "Yes / No",
  PASSWORD: "Password",
  DROPDOWN: "Dropdown",
  MULTI_SELECT: "Multi-select",
  CHECKBOX_GROUP: "Checkbox group",
  DATE: "Date",
  RATING: "Rating",
};

const OPTION_TYPES = new Set<FieldType>(["DROPDOWN", "MULTI_SELECT", "CHECKBOX_GROUP"]);

interface FieldConfig {
  options?: string[];
  maxLength?: number;
  max?: number;
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Option ${i + 1}`}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => onChange([...options, ""])}>
        Add option
      </Button>
    </div>
  );
}

/** One row in the canvas — drag handle + summary + actions. */
function SortableFieldRow({
  field: f,
  onEdit,
  onDelete,
}: {
  field: NonNullable<ReturnType<typeof useGetFields>["fields"]>[number];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="glass flex items-center gap-3 rounded-2xl p-4">
      <button
        type="button"
        {...attributes}
        {...listeners}
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

      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default function FormBuilder() {
  const params = useParams();
  const router = useRouter();
  const formId = params?.id as string | undefined;

  const { form, isLoading: formLoading } = useGetFormWithFields(formId ?? "");
  const { fields, isLoading: fieldsLoading } = useGetFields(formId ?? "");

  const {
    createFieldAsync,
    status: createStatus,
    error: createError,
  } = useCreateField(formId ?? "");
  const {
    updateFieldAsync,
    isPending: isUpdatingField,
    error: updateError,
  } = useUpdateField(formId ?? "");
  const { deleteFieldAsync } = useDeleteField(formId ?? "");
  const { reorderFieldsAsync } = useReorderFields(formId ?? "");
  const { updateFormAsync, isPending: isUpdatingForm } = useUpdateForm();
  const { deleteFormAsync, isPending: isDeletingForm } = useDeleteForm();

  // --- field create/edit dialog state ---
  const [open, setOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("TEXT");
  const [description, setDescription] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([""]);
  const [maxLength, setMaxLength] = useState<string>("");
  const [ratingMax, setRatingMax] = useState<string>("5");

  const resetDialog = () => {
    setEditingFieldId(null);
    setLabel("");
    setType("TEXT");
    setDescription("");
    setPlaceholder("");
    setIsRequired(false);
    setOptions([""]);
    setMaxLength("");
    setRatingMax("5");
  };

  const openCreateDialog = () => {
    resetDialog();
    setOpen(true);
  };

  const openEditDialog = (f: NonNullable<typeof fields>[number]) => {
    setEditingFieldId(f.id);
    setLabel(f.label);
    setType(f.type as FieldType);
    setDescription(f.description ?? "");
    setPlaceholder(f.placeholder ?? "");
    setIsRequired(f.isRequired);
    const cfg = (f.config ?? {}) as FieldConfig;
    setOptions(cfg.options && cfg.options.length > 0 ? cfg.options : [""]);
    setMaxLength(cfg.maxLength ? String(cfg.maxLength) : "");
    setRatingMax(cfg.max ? String(cfg.max) : "5");
    setOpen(true);
  };

  const buildConfig = (): FieldConfig | undefined => {
    if (OPTION_TYPES.has(type)) {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      return { options: cleaned };
    }
    if (type === "LONG_TEXT" && maxLength.trim()) return { maxLength: Number(maxLength) };
    if (type === "RATING") return { max: ratingMax.trim() ? Number(ratingMax) : 5 };
    return undefined;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formId) return;

    const config = buildConfig();

    try {
      if (editingFieldId) {
        await updateFieldAsync({
          fieldId: editingFieldId,
          label: label.trim(),
          description: description.trim() ? description.trim() : null,
          placeholder: placeholder.trim() ? placeholder.trim() : null,
          isRequired,
          config,
        });
      } else {
        await createFieldAsync({
          label: label.trim(),
          type,
          formId,
          description: description.trim() ? description.trim() : undefined,
          placeholder: placeholder.trim() ? placeholder.trim() : undefined,
          isRequired,
          config,
        });
      }
      setOpen(false);
      resetDialog();
    } catch {
      // error surfaced via createError/updateError below
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Delete this field? This can't be undone.")) return;
    try {
      await deleteFieldAsync({ fieldId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete field");
    }
  };

  // --- drag-and-drop reordering ---
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

  // --- form title/description/theme editing ---
  const [editingForm, setEditingForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    if (form) {
      setFormTitle(form.title);
      setFormDescription(form.description ?? "");
    }
  }, [form]);

  const handleSaveForm = async () => {
    if (!formId) return;
    try {
      await updateFormAsync({
        formId,
        title: formTitle.trim(),
        description: formDescription.trim() ? formDescription.trim() : null,
      });
      setEditingForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update form");
    }
  };

  type FormThemeKey = "MIDNIGHT" | "CORAL" | "MINT" | "LAVENDER" | "OCEAN";

  const handleThemeChange = async (themeKey: string) => {
    if (!formId) return;
    try {
      await updateFormAsync({ formId, theme: themeKey as FormThemeKey });
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
      toast.error(err instanceof Error ? err.message : "Failed to update form");
    }
  };

  const error = createError ?? updateError;
  const theme = getFormTheme(form?.theme);

  // Local, purely-visual values for the live preview — never submitted anywhere.
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* --- form header --- */}
          <div className="mb-6 space-y-3">
            {editingForm ? (
              <div className="glass space-y-3 rounded-2xl p-4">
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Form title"
                  className="text-lg font-semibold"
                />
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Form description (optional)"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveForm} disabled={isUpdatingForm}>
                    {isUpdatingForm ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {formLoading ? "Loading..." : form?.title}
                  </h1>
                  {form?.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowThemePicker((v) => !v)}>
                    <Palette className="mr-2 size-4" />
                    Theme
                  </Button>
                  <Button variant="outline" onClick={() => setEditingForm(true)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDeleteForm}
                    disabled={isDeletingForm}
                    className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete Form
                  </Button>
                </div>
              </div>
            )}

            {showThemePicker && (
              <div className="glass rounded-2xl p-4">
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  Theme — applied to this form's public page
                </p>
                <ThemePicker value={form?.theme ?? "MIDNIGHT"} onChange={handleThemeChange} />
              </div>
            )}
          </div>

          {/* --- canvas + live preview, side by side --- */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Canvas */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Fields</h2>

                <Dialog
                  open={open}
                  onOpenChange={(v) => {
                    setOpen(v);
                    if (!v) resetDialog();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openCreateDialog}>
                      Add field
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingFieldId ? "Edit Field" : "Create Field"}</DialogTitle>
                      <DialogDescription>
                        {editingFieldId ? "Update this field." : "Add a field to this form."}
                      </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                      <div>
                        <label className="mb-1 block text-sm text-muted-foreground">Label</label>
                        <Input
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="Field label"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-muted-foreground">Type</label>
                        {editingFieldId ? (
                          <div className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {FIELD_TYPE_LABELS[type]} (type can't be changed after creation)
                          </div>
                        ) : (
                          <select
                            value={type}
                            onChange={(e) => setType(e.target.value as FieldType)}
                            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                          >
                            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                              <option key={t} value={t}>
                                {FIELD_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {OPTION_TYPES.has(type) ? (
                        <div>
                          <label className="mb-1 block text-sm text-muted-foreground">
                            Options
                          </label>
                          <OptionsEditor options={options} onChange={setOptions} />
                        </div>
                      ) : null}

                      {type === "LONG_TEXT" ? (
                        <div>
                          <label className="mb-1 block text-sm text-muted-foreground">
                            Max length (optional)
                          </label>
                          <Input
                            type="number"
                            value={maxLength}
                            onChange={(e) => setMaxLength(e.target.value)}
                            placeholder="e.g. 500"
                          />
                        </div>
                      ) : null}

                      {type === "RATING" ? (
                        <div>
                          <label className="mb-1 block text-sm text-muted-foreground">
                            Scale (2-10)
                          </label>
                          <Input
                            type="number"
                            min={2}
                            max={10}
                            value={ratingMax}
                            onChange={(e) => setRatingMax(e.target.value)}
                          />
                        </div>
                      ) : null}

                      <div>
                        <label className="mb-1 block text-sm text-muted-foreground">
                          Description
                        </label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Optional helper text"
                        />
                      </div>

                      {!OPTION_TYPES.has(type) && type !== "YES_NO" ? (
                        <div>
                          <label className="mb-1 block text-sm text-muted-foreground">
                            Placeholder
                          </label>
                          <Input
                            value={placeholder}
                            onChange={(e) => setPlaceholder(e.target.value)}
                            placeholder="Optional placeholder"
                          />
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isRequired}
                          onCheckedChange={(v) => setIsRequired(Boolean(v))}
                        />
                        <span className="text-sm text-muted-foreground">Required</span>
                      </div>

                      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={createStatus === "pending" || isUpdatingField || !label.trim()}
                        >
                          {createStatus === "pending" || isUpdatingField
                            ? "Saving..."
                            : editingFieldId
                              ? "Save Changes"
                              : "Create Field"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {fieldsLoading ? (
                <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
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
                    <div className="space-y-2">
                      {fields.map((f) => (
                        <SortableFieldRow
                          key={f.id}
                          field={f}
                          onEdit={() => openEditDialog(f)}
                          onDelete={() => handleDeleteField(f.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                  No fields yet — add your first one above.
                </div>
              )}
            </section>

            {/* Live preview — the real public-page renderer, not a lookalike */}
            <section className="space-y-3 lg:sticky lg:top-6 lg:self-start">
              <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Eye className="size-3.5" />
                Live preview
              </h2>

              <div
                className="overflow-hidden rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                }}
              >
                <div className="p-6" style={{ color: theme.onGradient }}>
                  <h3 className="text-xl font-semibold">{form?.title || "Untitled form"}</h3>
                  {form?.description ? (
                    <p className="mt-1 text-sm opacity-80">{form.description}</p>
                  ) : null}
                </div>

                <div className="glass-strong m-3 rounded-xl p-5">
                  {!fields || fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Add a field to see it here.</p>
                  ) : (
                    <div className="space-y-5">
                      {fields.map((f) => (
                        <FormFieldRenderer
                          key={f.id}
                          field={f}
                          value={previewValues[f.id] ?? ""}
                          onChange={(v) => setPreviewValues((s) => ({ ...s, [f.id]: v }))}
                          accent={theme.accent}
                        />
                      ))}
                      <Button
                        type="button"
                        disabled
                        style={{ background: theme.accent, color: "#fff" }}
                        className="w-full cursor-default border-0 opacity-90"
                      >
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
