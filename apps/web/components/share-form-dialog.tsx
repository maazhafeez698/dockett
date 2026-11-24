"use client";

import { useState, type ReactNode } from "react";
import { Copy, Check, KeyRound, Clock, Mail, CircleCheck, Download } from "lucide-react";
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
  // Trigger element. Omit it when the dialog is controlled (open / onOpenChange). 
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  submissionAccess?: "ANYONE" | "ACCESS_CODE";
  accessCode?: string | null;
  respondentIdentity?: "ANONYMOUS" | "VERIFIED_EMAIL";
  oneResponsePerEmail?: boolean;
  // Live version number, shown after publishing. 
  version?: number | null;
  // Exact scheduled closing time (ISO), if the form closes automatically. 
  closesAt?: string | null;
  // True right after a successful publication. 
  justPublished?: boolean;
}

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

export function ShareFormDialog({
  formId,
  children,
  open,
  onOpenChange,
  submissionAccess = "ANYONE",
  accessCode,
  respondentIdentity = "ANONYMOUS",
  oneResponsePerEmail = false,
  version,
  closesAt,
  justPublished = false,
}: ShareFormDialogProps) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Falls back gracefully during SSR — window is only read once the
  // dialog actually opens client-side.
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/form/${formId}` : "";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=181818&bgcolor=F4F1EA&qzone=4&data=${encodeURIComponent(shareUrl)}`;
  const qrDownloadUrl = `/form-qr?url=${encodeURIComponent(shareUrl)}`;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            {justPublished ? <CircleCheck className="size-5 text-success" aria-hidden="true" /> : null}
            {justPublished ? (version ? `Version ${version} is live` : "Your form is live") : "Share this form"}
          </DialogTitle>
          <DialogDescription>
            {submissionAccess === "ACCESS_CODE"
              ? "Anyone with this link and the access code can fill it out."
              : "Anyone with this link can open and fill it out."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input value={shareUrl} readOnly onFocus={(e) => e.target.select()} className="text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copy link">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        {submissionAccess === "ACCESS_CODE" && accessCode ? (
          <div className="flex items-center gap-2 rounded-[3px] border border-border/60 bg-muted/30 p-3">
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

        {respondentIdentity === "VERIFIED_EMAIL" ? (
          <div className="flex items-start gap-2 rounded-[3px] border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Respondents confirm their email with a magic link first
              {oneResponsePerEmail ? " and can respond once per address" : ""}.
            </span>
          </div>
        ) : null}

        {closesAt ? (
          <div className="flex items-start gap-2 rounded-[3px] border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Clock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Closes automatically on <b className="text-foreground">{formatWhen(closesAt)}</b>.
            </span>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR code linking to the form"
            width={220}
            height={220}
            className="block size-[220px]"
          />
          <Button asChild type="button" variant="outline" className="w-full">
            <a href={qrDownloadUrl} download={`dockett-form-${formId}.png`}>
              <Download className="size-4" aria-hidden="true" />
              Download QR as PNG
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
