"use client";

import { Mail } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export function ContactSalesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const email = "maazhafeez.dev@gmail.com";
  const subject = encodeURIComponent("Dockett Business plan enquiry");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Sales</DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tell us about your team and what you need. We&apos;ll help you find the right plan.
        </p>
        <a
          href={`mailto:${email}?subject=${subject}`}
          className="flex items-center gap-4 border border-border bg-background/40 p-4 transition-colors hover:border-primary"
        >
          <span className="flex size-11 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
            <Mail className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide">Email our team</span>
            <span className="block break-all text-sm text-muted-foreground">{email}</span>
          </span>
        </a>
      </DialogContent>
    </Dialog>
  );
}
