// apps/web/app/dashboard/forms/[id]/page.tsx

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

import {
  useCreateField,
  useDeleteField,
  useGetFields,
  useReorderFields,
  useUpdateField,
} from "~/hooks/api/form-field";
import { useDeleteForm, useGetFormWithFields, useUpdateForm } from "~/hooks/api/form";

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
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        onClick={() => onChange([...options, ""])}
      >
        Add option
      </Button>
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
    if (type === "LONG_TEXT" && maxLength.trim()) {
      return { maxLength: Number(maxLength) };
    }
    if (type === "RATING") {
      return { max: ratingMax.trim() ? Number(ratingMax) : 5 };
    }
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

  const moveField = async (index: number, direction: -1 | 1) => {
    if (!fields || !formId) return;
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;

    const reordered = [...fields];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);

    try {
      await reorderFieldsAsync({ formId, orderedFieldIds: reordered.map((f) => f.id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder fields");
    }
  };

  // --- form title/description editing ---
  const [editingForm, setEditingForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

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

  const error = createError ?? updateError;

  return (
    <main className="min-h-screen bg-black px-6 py-6 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 space-y-3">
          {editingForm ? (
            <div className="space-y-2 border border-white/10 bg-white/5 p-4">
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
                <Button
                  onClick={handleSaveForm}
                  disabled={isUpdatingForm}
                  className="bg-white text-black"
                >
                  {isUpdatingForm ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingForm(false)}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold">
                  {formLoading ? "Loading..." : form?.title}
                </h1>
                {form?.description ? (
                  <p className="text-white/60 text-sm mt-1">{form.description}</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingForm(true)}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteForm}
                  disabled={isDeletingForm}
                  className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete Form
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) resetDialog();
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-white text-black" onClick={openCreateDialog}>
                  Create Field
                </Button>
              </DialogTrigger>

              <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingFieldId ? "Edit Field" : "Create Field"}</DialogTitle>
                  <DialogDescription className="text-white/60">
                    {editingFieldId ? "Update this field." : "Add a field to this form."}
                  </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="text-sm text-white/70 block mb-1">Label</label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Field label"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/70 block mb-1">Type</label>
                    {editingFieldId ? (
                      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                        {FIELD_TYPE_LABELS[type]} (type can't be changed after creation)
                      </div>
                    ) : (
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as FieldType)}
                        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
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
                      <label className="text-sm text-white/70 block mb-1">Options</label>
                      <OptionsEditor options={options} onChange={setOptions} />
                    </div>
                  ) : null}

                  {type === "LONG_TEXT" ? (
                    <div>
                      <label className="text-sm text-white/70 block mb-1">
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
                      <label className="text-sm text-white/70 block mb-1">Scale (2-10)</label>
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
                    <label className="text-sm text-white/70 block mb-1">Description</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional helper text"
                    />
                  </div>

                  {!OPTION_TYPES.has(type) && type !== "YES_NO" ? (
                    <div>
                      <label className="text-sm text-white/70 block mb-1">Placeholder</label>
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
                    <span className="text-sm text-white/70">Required</span>
                  </div>

                  {error ? <p className="text-sm text-red-400">{error.message}</p> : null}

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createStatus === "pending" || isUpdatingField || !label.trim()}
                      className="bg-white text-black"
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
        </div>

        <section className="grid gap-3">
          <div className="border border-white/10 bg-white/5 p-6 text-sm text-white/60">
            Form canvas — drag-and-drop is coming in the next phase; use the arrows below to reorder
            for now.
          </div>

          {fieldsLoading ? (
            <div className="border border-white/10 bg-white/5 p-4 text-sm text-white/50">
              Loading fields...
            </div>
          ) : fields && fields.length > 0 ? (
            fields.map((f, i) => (
              <div
                key={f.id}
                className="border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-white font-medium">
                    {f.label}
                    {f.isRequired ? <span className="ml-1 text-red-400">*</span> : null}
                  </div>
                  <div className="text-white/60 text-sm truncate">
                    {f.description || f.placeholder || ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-white/60">
                    {FIELD_TYPE_LABELS[f.type as FieldType]}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => moveField(i, -1)}
                    disabled={i === 0}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => moveField(i, 1)}
                    disabled={i === fields.length - 1}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => openEditDialog(f)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    onClick={() => handleDeleteField(f.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              No fields yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
