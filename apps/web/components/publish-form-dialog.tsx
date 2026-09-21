// apps/web/components/publish-form-dialog.tsx

"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useUpdateForm } from "~/hooks/api/form";

type Status = "DRAFT" | "PUBLISHED" | "CLOSED";
type Visibility = "PUBLIC" | "UNLISTED";
type SubmissionAccess = "ANYONE" | "AUTHENTICATED_ONLY" | "ANONYMOUS_ONLY";

const STATUS_OPTIONS: { value: Status; label: string; blurb: string }[] = [
  { value: "DRAFT", label: "Draft", blurb: "Only you can see and edit it" },
  { value: "PUBLISHED", label: "Published", blurb: "Live and accepting responses" },
  { value: "CLOSED", label: "Closed", blurb: "No longer accepting responses" },
];

const VISIBILITY_OPTIONS: { value: Visibility; label: string; blurb: string }[] = [
  { value: "PUBLIC", label: "Public", blurb: "Discoverable and shareable" },
  { value: "UNLISTED", label: "Unlisted", blurb: "Only reachable via direct link" },
];

const ACCESS_OPTIONS: { value: SubmissionAccess; label: string }[] = [
  { value: "ANYONE", label: "Anyone" },
  { value: "AUTHENTICATED_ONLY", label: "Signed-in users only" },
  { value: "ANONYMOUS_ONLY", label: "Anonymous only" },
];

interface PublishFormDialogProps {
  formId: string;
  currentStatus: Status;
  currentVisibility: Visibility;
  currentSubmissionAccess: SubmissionAccess;
  children: React.ReactNode;
}

export function PublishFormDialog({
  formId,
  currentStatus,
  currentVisibility,
  currentSubmissionAccess,
  children,
}: PublishFormDialogProps) {
  const { updateFormAsync, isPending } = useUpdateForm();

  const [status, setStatus] = useState<Status>(currentStatus);
  const [visibility, setVisibility] = useState<Visibility>(currentVisibility);
  const [submissionAccess, setSubmissionAccess] =
    useState<SubmissionAccess>(currentSubmissionAccess);
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    try {
      await updateFormAsync({ formId, status, visibility, submissionAccess });
      toast.success(status === "PUBLISHED" ? "Form published" : "Settings saved");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish settings</DialogTitle>
          <DialogDescription>Control who can find and respond to this form.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setStatus(o.value)}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    status === o.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="font-medium">{o.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Visibility
            </p>
            <div className="grid grid-cols-2 gap-2">
              {VISIBILITY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setVisibility(o.value)}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    visibility === o.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="font-medium">{o.label}</div>
                  <div className="text-muted-foreground">{o.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Who can submit
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ACCESS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSubmissionAccess(o.value)}
                  className={`rounded-xl border p-2 text-center text-xs transition-colors ${
                    submissionAccess === o.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Saved now — actually enforced in the upcoming visibility phase.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
