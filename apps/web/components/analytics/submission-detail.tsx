// apps/web/components/analytics/submission-detail.tsx
//
// Detail view for a single submission — every field's exact answer, with
// prev/next paging across the full response list (not just the "latest
// 10" shown as cards). Mirrors the reference's "Response Preview" screen.

"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useGetSubmissionDetail } from "~/hooks/api/analytics";

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
    <div className="glass-strong rounded-2xl p-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <p className="text-sm font-semibold">Response Preview</p>
          {index >= 0 ? (
            <p className="text-xs text-muted-foreground">
              {index + 1} of {orderedIds.length}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelect(orderedIds[index - 1]!)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={!hasNext}
            onClick={() => hasNext && onSelect(orderedIds[index + 1]!)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="default" size="sm" onClick={onClose} className="ml-1">
            <X className="mr-1 size-3.5" /> Close
          </Button>
        </div>
      </div>

      {isLoading || !detail ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading response...</div>
      ) : (
        <div className="pt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {(detail.answers.find((a) => a.value)?.value ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">
                Response {detail.isAuthenticated ? "· signed in" : "· anonymous"}
              </p>
              <p className="text-xs text-muted-foreground">
                {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {detail.answers.map((a) => (
              <div key={a.fieldId} className="flex gap-3 border-l-2 border-primary/40 pl-3.5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{a.label}</p>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                    {a.value.trim().length > 0 ? (
                      a.value
                    ) : (
                      <span className="text-muted-foreground italic">No answer</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
