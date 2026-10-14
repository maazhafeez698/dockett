// apps/web/components/file-upload-field.tsx
//
// The FILE_UPLOAD field on a live form: just an "Upload files" button (plus the list of files that
// are already attached). The upload experience — the basketball hoop — opens in a dialog.
//
//   - by default, browsing for files or dropping them uploads them immediately
//   - the "Shot mode" switch in the dialog makes every file score a basket first (a miss = a failed upload)
//
// The answer carried in form state is the list of server-verified upload ids (see lib/file-answer).

"use client";

import { useId, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { HoopUpload } from "~/components/hoop-upload/hoop-upload";
import { useFormUpload } from "~/components/form-upload-context";
import { encodeFileAnswer, formatBytes, parseFileAnswer } from "~/lib/file-answer";
import {
  ALL_KINDS,
  KIND_EXTENSIONS,
  KIND_LABELS,
  getUploadMeta,
  useFileFieldUploader,
  type UploadedFile,
} from "~/lib/file-upload";

export interface FileFieldConfig {
  accept?: string[];
  maxFiles?: number;
  maxSizeMB?: number;
}

export const DEFAULT_MAX_FILE_MB = 5;

export function fileFieldSettings(config: unknown) {
  const cfg = (config ?? {}) as FileFieldConfig;
  const kinds = (cfg.accept ?? []).filter((k) => (ALL_KINDS as readonly string[]).includes(k));
  const accept = kinds.length > 0 ? kinds : [...ALL_KINDS];
  const maxFiles = Math.min(5, Math.max(1, cfg.maxFiles ?? 1));
  const maxSizeMB = Math.min(10, Math.max(0.1, cfg.maxSizeMB ?? DEFAULT_MAX_FILE_MB));
  return { accept, maxFiles, maxSizeMB };
}

function BallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8" />
    </svg>
  );
}

interface FileUploadFieldProps {
  fieldId: string;
  label: string;
  config: unknown;
  value: string;
  onChange: (value: string) => void;
  /** Follow the app's dark theme (Dockett respondent form). */
  adaptive?: boolean;
  isMissing?: boolean;
}

export function FileUploadField({
  fieldId,
  label,
  config,
  value,
  onChange,
  adaptive,
  isMissing,
}: FileUploadFieldProps) {
  const { formId, accessCode, isPreview } = useFormUpload();
  const { accept, maxFiles, maxSizeMB } = fileFieldSettings(config);
  const { upload, discard } = useFileFieldUploader({ formId: formId ?? "", fieldId, accessCode });

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Shot mode is opt-in: off by default, so browsing / dropping uploads straight away.
  const [shotOn, setShotOn] = useState(false);
  const shotId = useId();

  // The ref is the source of truth for the answer (callbacks can fire several times between renders);
  // `ids` mirrors it for rendering the attached-files list.
  const idsRef = useRef<string[]>(parseFileAnswer(value).ids.filter((id) => !!getUploadMeta(id)));
  const [ids, setIds] = useState<string[]>(idsRef.current);
  const busyRef = useRef(false);
  const emit = useRef(onChange);
  emit.current = onChange;
  const push = () => emit.current(encodeFileAnswer(idsRef.current, busyRef.current));
  const setAnswerIds = (next: string[]) => {
    idsRef.current = next;
    setIds(next);
  };

  const initialFiles = ids
    .map((id) => ({ id, meta: getUploadMeta(id) }))
    .filter((x): x is { id: string; meta: { name: string; size: number } } => !!x.meta)
    .map((x) => ({
      file: { name: x.meta.name, size: x.meta.size },
      result: { uploadId: x.id, name: x.meta.name, size: x.meta.size, kind: "" },
    }));

  const kinds = accept.map((k) => KIND_LABELS[k]).join(", ");
  const acceptAttr = accept.flatMap((k) => KIND_EXTENSIONS[k] ?? []).join(",");
  const subtitle = `${kinds} · up to ${maxSizeMB} MB${maxFiles > 1 ? ` · max ${maxFiles} files` : ""}`;

  const handleOpenChange = (next: boolean) => {
    if (!next && busyRef.current) {
      toast.info("Your upload is still running — it will be ready in a moment.");
      return;
    }
    setOpen(next);
  };

  const removeFile = (id: string) => {
    setAnswerIds(idsRef.current.filter((x) => x !== id));
    discard(id);
    push();
  };

  return (
    <div className="space-y-2" aria-invalid={isMissing || undefined}>
      <div
        className={`flex flex-wrap items-center gap-3 ${isMissing ? "rounded-sm ring-1 ring-destructive ring-offset-4 ring-offset-transparent" : ""}`}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`${label}: ${ids.length > 0 ? "add or change files" : "upload files"}`}
        >
          <Upload /> {ids.length > 0 ? "Add or change files" : "Upload files"}
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
      </div>

      {ids.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Attached files">
          {ids.map((id) => {
            const meta = getUploadMeta(id);
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{meta?.name ?? "Uploaded file"}</span>
                  {meta ? (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatBytes(meta.size)}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  aria-label={`Remove ${meta?.name ?? "file"}`}
                  className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-[480px] gap-3 overflow-y-auto p-3 sm:max-w-[480px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Upload files</DialogTitle>
            <DialogDescription>
              Browse for files or drop them here to upload them right away. Turn on shot mode to
              score a basket with each file before it uploads.
            </DialogDescription>
          </DialogHeader>

          <div
            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors ${
              shotOn ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <label htmlFor={shotId} className="flex min-w-0 cursor-pointer items-center gap-2.5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
                  shotOn
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <BallIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-bold">Shot mode</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {shotOn ? "Score a basket to upload each file" : "Off — files upload instantly"}
                </span>
              </span>
            </label>
            <Switch
              id={shotId}
              checked={shotOn}
              onCheckedChange={setShotOn}
              aria-label="Shot mode"
            />
          </div>

          <HoopUpload
            // limits are read once at mount: re-mount if the field's settings change
            key={`${acceptAttr}|${maxFiles}|${maxSizeMB}|${isPreview}`}
            accept={acceptAttr}
            multiple={maxFiles > 1}
            maxFiles={maxFiles}
            maxSize={Math.floor(maxSizeMB * 1024 * 1024)}
            adaptive={adaptive}
            shotMode={shotOn}
            disabled={isPreview || !formId}
            initialFiles={initialFiles}
            text={{ title: "Upload files", subtitle }}
            upload={upload}
            onUploaded={(_file, result) => {
              const r = result as UploadedFile;
              if (!idsRef.current.includes(r.uploadId))
                setAnswerIds([...idsRef.current, r.uploadId]);
              push();
            }}
            onRemove={(_file, result) => {
              const r = result as UploadedFile | undefined;
              if (r?.uploadId) {
                setAnswerIds(idsRef.current.filter((id) => id !== r.uploadId));
                discard(r.uploadId);
              }
              push();
            }}
            onBusyChange={(b) => {
              busyRef.current = b;
              setUploading(b);
              push();
            }}
          />

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              {uploading
                ? "Uploading…"
                : `${ids.length} of ${maxFiles} file${maxFiles === 1 ? "" : "s"} attached`}
            </span>
            <Button type="button" onClick={() => handleOpenChange(false)} disabled={uploading}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
