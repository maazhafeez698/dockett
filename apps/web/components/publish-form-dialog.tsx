// apps/web/components/publish-form-dialog.tsx
//
// Publish is the headline action — front and center, one click. Visibility
// and "who can submit" are real settings, not busywork every owner has to
// wade through, so they live behind an "Access settings" disclosure that
// starts collapsed with sensible defaults (Public / Anyone) already
// applied. Opening it is optional; publishing isn't gated on touching it.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Copy, KeyRound, RotateCw } from "lucide-react";

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
import { useRegenerateAccessCode, useUpdateForm } from "~/hooks/api/form";
import { toastError } from "~/lib/plan-limit";

type Status = "DRAFT" | "PUBLISHED" | "CLOSED";
type Visibility = "PUBLIC" | "UNLISTED";
type SubmissionAccess = "ANYONE" | "ACCESS_CODE" | "AUTHENTICATED_ONLY";

const STATUS_OPTIONS: { value: Status; label: string; blurb: string }[] = [
  { value: "DRAFT", label: "Draft", blurb: "Only you can see it" },
  { value: "PUBLISHED", label: "Published", blurb: "Live and accepting responses" },
  { value: "CLOSED", label: "Closed", blurb: "No longer accepting responses" },
];

const VISIBILITY_OPTIONS: { value: Visibility; label: string; blurb: string }[] = [
  { value: "PUBLIC", label: "Public", blurb: "Discoverable and shareable" },
  { value: "UNLISTED", label: "Unlisted", blurb: "Only reachable via direct link" },
];

const ACCESS_OPTIONS: { value: SubmissionAccess; label: string; blurb: string }[] = [
  {
    value: "ANYONE",
    label: "Anyone with the link",
    blurb: "No sign-in, no code — the open default",
  },
  {
    value: "ACCESS_CODE",
    label: "Requires a code",
    blurb: "Good for a private group — share the code separately from the link",
  },
  {
    value: "AUTHENTICATED_ONLY",
    label: "Signed-in users only",
    blurb: "Respondent needs a Formless account",
  },
];

interface PublishFormDialogProps {
  formId: string;
  currentStatus: Status;
  currentVisibility: Visibility;
  currentSubmissionAccess: SubmissionAccess;
  currentAccessCode?: string | null;
  children: React.ReactNode;
}

export function PublishFormDialog({
  formId,
  currentStatus,
  currentVisibility,
  currentSubmissionAccess,
  currentAccessCode,
  children,
}: PublishFormDialogProps) {
  const router = useRouter();
  const { updateFormAsync, isPending } = useUpdateForm();
  const { regenerateAccessCodeAsync, isPending: regenerating } = useRegenerateAccessCode();

  const [status, setStatus] = useState<Status>(currentStatus);
  const [visibility, setVisibility] = useState<Visibility>(currentVisibility);
  const [submissionAccess, setSubmissionAccess] =
    useState<SubmissionAccess>(currentSubmissionAccess);
  const [accessCode, setAccessCode] = useState<string | null | undefined>(currentAccessCode);
  const [advancedOpen, setAdvancedOpen] = useState(currentSubmissionAccess !== "ANYONE");
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    try {
      await updateFormAsync({ formId, status, visibility, submissionAccess });
      toast.success(status === "PUBLISHED" ? "Form published" : "Settings saved");
      setOpen(false);
    } catch (err) {
      toastError(err, "Failed to update form", () => router.push("/dashboard/billing"));
    }
  };

  const handleRegenerate = async () => {
    try {
      const result = await regenerateAccessCodeAsync({ formId });
      setAccessCode(result.accessCode);
      setSubmissionAccess("ACCESS_CODE");
      toast.success("New code generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate a code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish</DialogTitle>
          <DialogDescription>
            Make this form live. Change who can find and respond to it below, if needed.
          </DialogDescription>
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

          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Access settings
            </span>
            <ChevronDown
              className={`size-3.5 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>

          {advancedOpen ? (
            <div className="space-y-5 rounded-xl border border-border/60 p-3.5">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Who can find this form</p>
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
                <p className="mb-2 text-xs text-muted-foreground">
                  Who can submit a response — pick whatever fits this form's use case
                </p>
                <div className="space-y-2">
                  {ACCESS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSubmissionAccess(o.value)}
                      className={`block w-full rounded-xl border p-2.5 text-left text-xs transition-colors ${
                        submissionAccess === o.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-medium">{o.label}</div>
                      <div className="text-muted-foreground">{o.blurb}</div>
                    </button>
                  ))}
                </div>

                {submissionAccess === "ACCESS_CODE" ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <KeyRound className="size-4 text-muted-foreground" />
                    {accessCode ? (
                      <span className="flex-1 font-mono text-sm tracking-[0.3em]">
                        {accessCode}
                      </span>
                    ) : (
                      <span className="flex-1 text-xs text-muted-foreground">
                        A code will be generated when you save.
                      </span>
                    )}
                    {accessCode ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(accessCode);
                          toast.success("Code copied");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy code"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="text-muted-foreground hover:text-foreground"
                      title="Generate a new code"
                    >
                      <RotateCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : status === "PUBLISHED" ? "Publish" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
