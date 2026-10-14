// apps/web/components/analytics/file-answer.tsx
//
// A FILE_UPLOAD answer in the response viewer: file names with a Download button. Downloads go
// through an owner-only endpoint that mints a 5-minute signed link — the files are private and
// have no public URL.

"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { formatBytes, parseStoredFiles } from "~/lib/file-answer";
import { trpc } from "~/trpc/client";

export function FileAnswer({ value }: { value: string }) {
  const files = parseStoredFiles(value);
  const download = trpc.fileUpload.getDownloadUrl.useMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (files.length === 0) {
    return <p className="mt-1 text-sm text-muted-foreground italic">No answer</p>;
  }

  const handleDownload = async (id: string) => {
    setBusyId(id);
    try {
      const { url } = await download.mutateAsync({ uploadId: id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create a download link.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ul className="mt-1.5 space-y-1.5">
      {files.map((f) => (
        <li
          key={f.id}
          className="flex items-center justify-between gap-3 border border-border bg-background/40 px-3 py-2"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{f.name}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {formatBytes(f.size)}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownload(f.id)}
            disabled={busyId === f.id}
          >
            {busyId === f.id ? <Loader2 className="animate-spin" /> : <Download />} Download
          </Button>
        </li>
      ))}
    </ul>
  );
}
