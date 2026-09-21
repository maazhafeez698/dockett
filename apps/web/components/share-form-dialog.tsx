// apps/web/components/share-form-dialog.tsx

"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
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
}

export function ShareFormDialog({ formId, children }: ShareFormDialogProps) {
  const [copied, setCopied] = useState(false);

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
          <DialogDescription>Anyone with this link can open and fill it out.</DialogDescription>
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

        <div className="flex justify-center py-2">
          <div className="glass rounded-2xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="QR code linking to the form"
              width={220}
              height={220}
              className="rounded-lg"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
