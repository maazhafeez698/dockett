// apps/web/components/share-form-dialog.tsx

"use client";

import { useState } from "react";
import { Copy, Check, KeyRound, LogIn } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

interface ShareFormDialogProps {
  formId: string;
  children: React.ReactNode;
  submissionAccess?: "ANYONE" | "ACCESS_CODE" | "AUTHENTICATED_ONLY";
  accessCode?: string | null;
}

export function ShareFormDialog({
  formId,
  children,
  submissionAccess = "ANYONE",
  accessCode,
}: ShareFormDialogProps) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Falls back gracefully during SSR — window is only read once the
  // dialog actually opens client-side.
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/form/${formId}` : "";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy the link manually");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-strong sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share this form</DialogTitle>
          <DialogDescription>
            {submissionAccess === "ACCESS_CODE"
              ? "Anyone with this link and the access code can fill it out."
              : submissionAccess === "AUTHENTICATED_ONLY"
                ? "Anyone with this link can open it, but they'll need to sign in to respond."
                : "Anyone with this link can open and fill it out."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input value={shareUrl} readOnly onFocus={(e) => e.target.select()} className="text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label="Copy link"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        {submissionAccess === "ACCESS_CODE" && accessCode ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
            <KeyRound className="size-4 text-muted-foreground" />
            <span className="flex-1 font-mono text-sm tracking-[0.3em]">{accessCode}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(accessCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                } catch {
                  toast.error("Couldn't copy — copy the code manually");
                }
              }}
              aria-label="Copy access code"
            >
              {codeCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        ) : null}

        {submissionAccess === "AUTHENTICATED_ONLY" ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <LogIn className="size-3.5 shrink-0" />
            Only respondents signed in to a Formless account can submit.
          </div>
        ) : null}

        <div className="flex justify-center py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR code linking to the form"
            width={220}
            height={220}
            className="block size-[220px]"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
