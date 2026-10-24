"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

import {
  FIELD_MIME,
  PALETTE,
  TYPE_MIME,
  getOptions,
  typeLabel,
  type BuilderField,
  type FieldConfig,
  type FieldType,
} from "./field-types";
import { ALL_AT_ONCE_PAGE_SIZE, MAX_FIELDS_PER_FORM } from "@repo/services/form-field/limits";

type DragState = { kind: "field"; id: string } | { kind: "type"; type: string } | null;

interface ListViewProps {
  fields: BuilderField[];
  loading: boolean;
  selectedFieldId: string | null;
  onSelect: (id: string | null) => void;
  onAddField: (type: FieldType) => void;
  onDropNewField: (type: string, afterFieldId: string | undefined) => void;
  /** Resolves true when the server accepted the new order. */
  onReorder: (orderedIds: string[]) => Promise<boolean>;
  onDeleteField: (id: string) => void;
  onRemoveOption: (fieldId: string, index: number) => void;
  onOpenAi: () => void;
  /** Opens the inspector sheet (below the xl breakpoint). */
  onEdit: () => void;
  formTitle: string;
  onTitleChange: (value: string) => void;
  onTitleCommit: () => void;
  formDescription?: string | null;
  layout: "ONE_AT_A_TIME" | "ALL_AT_ONCE";
}

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

function PaletteTile({
  type,
  short,
  icon: Icon,
  onAdd,
  onDragStart,
  onDragEnd,
  compact,
  disabled,
}: {
  type: FieldType;
  short: string;
  icon: (typeof PALETTE)[number]["icon"];
  onAdd: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  compact?: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(TYPE_MIME, type);
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onAdd}
      title={`Add ${short}`}
      className={`group flex flex-col items-center justify-center gap-1.5 rounded-[3px] border border-transparent bg-ink text-paper transition-all hover:border-primary hover:-translate-y-px active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:border-border dark:bg-secondary ${
        compact ? "h-14 w-[76px] shrink-0" : "h-[62px]"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="font-mono text-[10px] leading-none">{short}</span>
    </button>
  );
}

function PagesPanel({
  fields,
  layout,
  selectedFieldId,
  onSelect,
}: Pick<ListViewProps, "fields" | "layout" | "selectedFieldId" | "onSelect">) {
  if (fields.length === 0) {
    return <p className="p-1 text-xs text-muted-foreground">No pages yet — add a field first.</p>;
  }
  const paged = layout === "ONE_AT_A_TIME";
  const pages = paged
    ? fields.map((field) => [field])
    : Array.from({ length: Math.ceil(fields.length / ALL_AT_ONCE_PAGE_SIZE) }, (_, i) =>
        fields.slice(i * ALL_AT_ONCE_PAGE_SIZE, (i + 1) * ALL_AT_ONCE_PAGE_SIZE),
      );
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-muted-foreground">
        {paged
          ? "One question per page — respondents see them in this order."
          : `All at once — up to ${ALL_AT_ONCE_PAGE_SIZE} fields per page, grouped automatically.`}
      </p>
      <ol className="space-y-2">
        {pages.map((page, pageIndex) => (
          <li key={pageIndex} className="space-y-1">
            <div className="mono-label-sm flex justify-between text-primary">
              <span>P{String(pageIndex + 1).padStart(2, "0")}</span>
              {!paged ? <span className="text-muted-foreground">{page.length} fields</span> : null}
            </div>
            {page.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                className={`flex w-full items-center gap-2 rounded-[2px] border px-2 py-1.5 text-left transition-colors ${
                  selectedFieldId === f.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-foreground/50"
                }`}
              >
                <span className="truncate text-xs font-medium">{f.label}</span>
              </button>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field previews                                                      */
/* ------------------------------------------------------------------ */

function FieldPreview({
  field,
  onRemoveOption,
}: {
  field: BuilderField;
  onRemoveOption: (index: number) => void;
}) {
  const type = field.type;
  const box =
    "flex items-center border border-input bg-background/40 px-3 font-mono text-xs text-muted-foreground";

  switch (type) {
    case "LONG_TEXT":
      return (
        <div className={`${box} h-20 items-start py-2.5`}>
          {field.placeholder || "Type your answer…"}
        </div>
      );
    case "EMAIL":
      return <div className={`${box} h-9`}>{field.placeholder || "name@example.com"}</div>;
    case "NUMBER":
      return <div className={`${box} h-9`}>{field.placeholder || "0"}</div>;
    case "PASSWORD":
      return <div className={`${box} h-9 tracking-[0.3em]`}>{field.placeholder || "••••••••"}</div>;
    case "DATE":
      return <div className={`${box} h-9`}>dd / mm / yyyy</div>;
    case "YES_NO":
      return (
        <div className="flex gap-2">
          {["Yes", "No"].map((t) => (
            <span key={t} className={`${box} h-9 flex-1 justify-center`}>
              {t}
            </span>
          ))}
        </div>
      );
    case "FILE_UPLOAD": {
      const cfg = (field.config ?? {}) as FieldConfig;
      return (
        <div
          className={`${box} h-20 flex-col items-center justify-center gap-1 border-dashed text-center`}
        >
          <Upload className="size-4" aria-hidden="true" />
          <span>Drop files here · slingshot upload</span>
          <span className="text-[10px] opacity-70">
            {(cfg.accept && cfg.accept.length ? cfg.accept : ["pdf", "docx", "jpg", "png"])
              .map((k) => (k === "jpg" ? "JPEG" : k.toUpperCase()))
              .join(", ")}{" "}
            · up to {cfg.maxSizeMB ?? 5} MB
          </span>
        </div>
      );
    }
    case "RATING": {
      const max = Math.min(10, Math.max(2, ((field.config ?? {}) as FieldConfig).max ?? 5));
      return (
        <div className="flex gap-1 text-muted-foreground" aria-hidden="true">
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} className="size-5" />
          ))}
        </div>
      );
    }
    case "DROPDOWN":
    case "MULTI_SELECT":
    case "RADIO_GROUP":
    case "CHECKBOX_GROUP": {
      const opts = getOptions(field);
      const shown = opts.slice(0, 5);
      return (
        <div className="space-y-1.5">
          {shown.map((o, i) => (
            <div key={`${o}-${i}`} className={`${box} h-9 justify-between`}>
              <span className="flex items-center gap-2">
                <span aria-hidden="true">
                  {type === "DROPDOWN" || type === "RADIO_GROUP" ? "○" : "□"}
                </span>
                {o}
              </span>
              <button
                type="button"
                aria-label={`Remove option ${o}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOption(i);
                }}
                className="px-1 text-sm leading-none transition-colors hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
          {opts.length > shown.length ? (
            <div className="mono-label-sm text-muted-foreground">
              +{opts.length - shown.length} more
            </div>
          ) : null}
          {opts.length === 0 ? <div className={`${box} h-9`}>No options yet</div> : null}
        </div>
      );
    }
    default:
      return <div className={`${box} h-9`}>{field.placeholder || "Enter your answer…"}</div>;
  }
}

function DropLine() {
  return (
    <div className="relative my-1 h-0.5 bg-primary" aria-hidden="true">
      <span className="mono-label-sm absolute -top-2 left-2 bg-primary px-1 py-0.5 text-primary-foreground">
        Drop here
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function ListView(props: ListViewProps) {
  const {
    fields,
    loading,
    selectedFieldId,
    onSelect,
    onAddField,
    onDropNewField,
    onReorder,
    onDeleteField,
    onRemoveOption,
    onOpenAi,
    onEdit,
    formTitle,
    onTitleChange,
    onTitleCommit,
    formDescription,
    layout,
  } = props;

  const [tab, setTab] = useState<"fields" | "pages">("fields");
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState<DragState>(null);
  const [over, setOver] = useState<number | null>(null);
  // optimistic order, cleared as soon as the server list changes
  const [pending, setPending] = useState<string[] | null>(null);

  useEffect(() => setPending(null), [fields]);

  const ordered = useMemo(() => {
    if (!pending) return fields;
    const byId = new Map(fields.map((f) => [f.id, f]));
    const list = pending.map((id) => byId.get(id)).filter((f): f is BuilderField => !!f);
    return list.length === fields.length ? list : fields;
  }, [fields, pending]);

  const palette = PALETTE.filter((p) =>
    `${p.short} ${p.label}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const canAddFields = !loading && fields.length < MAX_FIELDS_PER_FORM;

  const commitOrder = async (ids: string[]) => {
    if (ids.join(",") === ordered.map((f) => f.id).join(",")) return;
    setPending(ids);
    const ok = await onReorder(ids);
    if (!ok) setPending(null);
  };

  const moveTo = (id: string, insertIndex: number) => {
    const ids = ordered.map((f) => f.id);
    const from = ids.indexOf(id);
    if (from === -1) return;
    ids.splice(from, 1);
    ids.splice(insertIndex > from ? insertIndex - 1 : insertIndex, 0, id);
    void commitOrder(ids);
  };

  const step = (id: string, dir: -1 | 1) => {
    const ids = ordered.map((f) => f.id);
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    void commitOrder(ids);
  };

  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const index = over ?? ordered.length;
    if (drag?.kind === "field") moveTo(drag.id, index);
    else if (drag?.kind === "type") {
      onDropNewField(drag.type, index > 0 ? ordered[index - 1]?.id : undefined);
    } else {
      // palette drag from another window / browser quirk: fall back to the MIME payload
      const type = e.dataTransfer.getData(TYPE_MIME);
      if (type) onDropNewField(type, index > 0 ? ordered[index - 1]?.id : undefined);
    }
    endDrag();
  };

  const tiles = (compact?: boolean) =>
    palette.map((p) => (
      <PaletteTile
        key={p.type}
        type={p.type}
        short={p.short}
        icon={p.icon}
        compact={compact}
        disabled={!canAddFields}
        onAdd={() => onAddField(p.type)}
        onDragStart={() => setDrag({ kind: "type", type: p.type })}
        onDragEnd={endDrag}
      />
    ));

  return (
    <>
      {/* ---------- palette (lg+) ---------- */}
      <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border border-border bg-card p-3 lg:flex">
        <div
          className="grid grid-cols-2 border border-border p-0.5"
          role="tablist"
          aria-label="Palette"
        >
          {(["fields", "pages"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`mono-label-sm rounded-[2px] py-2 transition-colors ${
                tab === t
                  ? "bg-solid text-solid-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "fields" ? (
          <>
            <label className="flex items-center gap-2 border border-input bg-background/40 px-2.5 focus-within:border-primary">
              <Search className="size-3 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search field types"
                className="h-8 w-full bg-transparent font-mono text-[11px] outline-none placeholder:text-muted-foreground"
              />
            </label>

            <div className="mono-label-sm text-muted-foreground">Form components</div>
            <div className="grid grid-cols-2 gap-1.5">
              {tiles()}
              {search.trim() === "" ? (
                <button
                  type="button"
                  onClick={onOpenAi}
                  disabled={!canAddFields}
                  className="flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-[3px] border border-primary bg-primary/10 text-primary transition-all hover:-translate-y-px hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  <span className="font-mono text-[10px] leading-none">AI field</span>
                </button>
              ) : null}
            </div>
            {palette.length === 0 ? (
              <p className="text-xs text-muted-foreground">No components match “{search}”.</p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {fields.length}/{MAX_FIELDS_PER_FORM} fields
              {!canAddFields ? " — limit reached; delete a field to add another." : ""}
            </p>
            <p className="mt-auto text-[11px] leading-snug text-muted-foreground">
              Drag a component into the form, or click to add it to the end.
            </p>
          </>
        ) : (
          <PagesPanel
            fields={ordered}
            layout={layout}
            selectedFieldId={selectedFieldId}
            onSelect={onSelect}
          />
        )}
      </aside>

      {/* ---------- canvas ---------- */}
      <section
        className="dotgrid-strong relative flex min-h-0 min-w-0 flex-col border border-border bg-card/40"
        aria-label="Form fields"
      >
        {/* palette strip (below lg) */}
        <div className="scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-card p-2 lg:hidden">
          <span className="flex shrink-0 items-center px-1 font-mono text-[10px] text-muted-foreground">
            {fields.length}/{MAX_FIELDS_PER_FORM}
          </span>
          {tiles(true)}
          <button
            type="button"
            onClick={onOpenAi}
            disabled={!canAddFields}
            className="flex h-14 w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[3px] border border-primary text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="size-4" />
            <span className="font-mono text-[10px] leading-none">AI field</span>
          </button>
        </div>

        <div
          className="min-h-0 min-w-0 flex-1 overflow-y-auto"
          onClick={() => onSelect(null)}
          onDragOver={(e) => {
            if (!drag) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = drag.kind === "type" ? "copy" : "move";
            if (e.target === e.currentTarget) setOver(ordered.length);
          }}
          onDrop={handleDrop}
        >
          <div
            className="mx-auto w-full max-w-[540px] space-y-2.5 px-3 py-5 pb-24 sm:px-5"
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              if (drag && e.target === e.currentTarget) {
                e.preventDefault();
                setOver(ordered.length);
              }
            }}
          >
            {/* heading block = the form's own title */}
            <div
              onClick={() => onSelect(null)}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                e.stopPropagation();
                setOver(0);
              }}
              className={`border bg-card p-4 transition-colors ${
                selectedFieldId === null ? "border-foreground/70" : "border-border"
              }`}
            >
              <div className="mono-label-sm text-muted-foreground">Heading</div>
              <input
                value={formTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onBlur={onTitleCommit}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                aria-label="Form title"
                placeholder="Untitled Form"
                className="font-display mt-1 w-full bg-transparent text-[26px] leading-tight font-extrabold outline-none placeholder:text-muted-foreground/60"
              />
              {formDescription ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{formDescription}</p>
              ) : null}
            </div>

            {loading ? (
              <div className="space-y-2.5" aria-busy="true">
                {[0, 1].map((i) => (
                  <div key={i} className="h-32 animate-pulse border border-border bg-card" />
                ))}
              </div>
            ) : null}

            {ordered.map((field, i) => {
              const selected = field.id === selectedFieldId;
              const dragging = drag?.kind === "field" && drag.id === field.id;
              return (
                <div key={field.id}>
                  {drag && over === i ? <DropLine /> : null}
                  <article
                    draggable
                    aria-label={`${typeLabel(field.type)}: ${field.label}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(FIELD_MIME, field.id);
                      e.dataTransfer.setData("text/plain", field.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDrag({ kind: "field", id: field.id });
                    }}
                    onDragEnd={endDrag}
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      setOver(i + (e.clientY > r.top + r.height / 2 ? 1 : 0));
                    }}
                    onClick={() => onSelect(field.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(field.id);
                      }
                      if (e.altKey && e.key === "ArrowUp") {
                        e.preventDefault();
                        step(field.id, -1);
                      }
                      if (e.altKey && e.key === "ArrowDown") {
                        e.preventDefault();
                        step(field.id, 1);
                      }
                      if (e.key === "Delete" || e.key === "Backspace") onDeleteField(field.id);
                    }}
                    className={`group relative border bg-card p-4 outline-none transition-all ${
                      selected
                        ? "border-2 border-primary"
                        : "border-border hover:border-foreground/50 focus-visible:border-foreground/60"
                    } ${dragging ? "opacity-40" : ""}`}
                  >
                    {selected ? (
                      <>
                        <span
                          className="absolute -top-[5px] left-1/2 size-2 -translate-x-1/2 border border-card bg-primary"
                          aria-hidden="true"
                        />
                        <span
                          className="absolute -bottom-[5px] left-1/2 size-2 -translate-x-1/2 border border-card bg-primary"
                          aria-hidden="true"
                        />
                      </>
                    ) : null}

                    <div className="flex items-start justify-between gap-2">
                      <div className="mono-label-sm min-w-0 truncate text-muted-foreground">
                        {typeLabel(field.type)}
                        {field.isRequired ? (
                          <span className="text-primary"> · Required</span>
                        ) : null}
                      </div>
                      <div
                        className={`-mt-1 -mr-1 flex items-center ${
                          selected
                            ? "opacity-100"
                            : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                        } transition-opacity`}
                      >
                        <button
                          type="button"
                          aria-label="Edit field"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(field.id);
                            onEdit();
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground xl:hidden"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            step(field.id, -1);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={i === ordered.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            step(field.id, 1);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete field"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteField(field.id);
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                        <span
                          className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
                          aria-hidden="true"
                        >
                          <GripVertical className="size-3.5" />
                        </span>
                      </div>
                    </div>

                    <h3 className="font-display mt-1 break-words text-[22px] leading-tight font-extrabold">
                      {field.label}
                    </h3>
                    {field.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
                    ) : null}

                    <div className="mt-3">
                      <FieldPreview
                        field={field}
                        onRemoveOption={(idx) => onRemoveOption(field.id, idx)}
                      />
                    </div>
                  </article>
                </div>
              );
            })}

            {drag && over === ordered.length ? <DropLine /> : null}

            {!loading && ordered.length === 0 ? (
              <div className="border border-dashed border-foreground/40 p-8 text-center">
                <p className="font-display text-lg font-extrabold">No fields yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Drag a component here, click one to add it, or let AI draft the form.
                </p>
              </div>
            ) : (
              <div
                className="mono-label-sm border border-dashed border-border py-5 text-center text-muted-foreground"
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setOver(ordered.length);
                }}
              >
                Drop a component here to add it to the end
              </div>
            )}
          </div>
        </div>

      </section>
    </>
  );
}
