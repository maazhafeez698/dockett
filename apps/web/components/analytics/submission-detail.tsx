// apps/web/components/analytics/submission-detail.tsx
//
// Detail view for a single submission — every field's exact answer, with
// prev/next paging across the full response list (not just the "latest
// 10" shown as cards). Mirrors the reference's "Response Preview" screen.

"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useGetSubmissionDetail } from "~/hooks/api/analytics";
import { FileAnswer } from "~/components/analytics/file-answer";

interface SubmissionDetailProps {
  submissionId: string;
  /** Ordered ids from the same list the card grid renders, so prev/next
   * walks the real response order rather than just the visible cards. */
  orderedIds: string[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function SubmissionDetail({
  submissionId,
  orderedIds,
  onSelect,
  onClose,
}: SubmissionDetailProps) {
  const { detail, isLoading } = useGetSubmissionDetail(submissionId);

  const index = orderedIds.indexOf(submissionId);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < orderedIds.length - 1;

  return (
    <div className="border border-foreground/70 bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-dashed border-border pb-4">
        <div>
          <p className="font-display text-xl font-extrabold">Response preview</p>
          {index >= 0 ? (
            <p className="mono-label-sm mt-0.5 text-muted-foreground">
              {index + 1} of {orderedIds.length}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous response"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelect(orderedIds[index - 1]!)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next response"
            disabled={!hasNext}
            onClick={() => hasNext && onSelect(orderedIds[index + 1]!)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="default" size="sm" onClick={onClose} className="ml-1">
            <X /> Close
          </Button>
        </div>
      </div>

      {isLoading || !detail ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading response...</div>
      ) : (
        <div className="pt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[3px] bg-primary/15 font-mono text-xs font-bold text-primary">
              {(detail.answers.find((a) => a.value)?.value ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">
                Response {detail.respondentEmail ? `· ${detail.respondentEmail}` : "· anonymous"}
              </p>
              <p className="text-xs text-muted-foreground">
                {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : "—"}
                {detail.version ? ` · answered version ${detail.version}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {detail.answers.map((a) => (
              <div key={a.fieldId} className="flex gap-3 border-l-2 border-primary pl-3.5">
                <div>
                  <p className="mono-label-sm text-muted-foreground">{a.label}</p>
                  {a.type === "FILE_UPLOAD" && a.value.trim().length > 0 ? (
                    <FileAnswer value={a.value} />
                  ) : (
                    <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                      {a.value.trim().length > 0 ? (
                        a.value
                      ) : (
                        <span className="text-muted-foreground italic">No answer</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
