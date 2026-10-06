"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { env } from "~/env.js";

// Placeholders until you set NEXT_PUBLIC_SALES_EMAIL / _WHATSAPP / _PHONE in the root .env.
const PLACEHOLDERS = {
  email: "sales@your-domain.com",
  whatsapp: "+00 000 0000000",
  phone: "+00 000 0000000",
};

function digits(v: string) {
  return v.replace(/[^\d]/g, "");
}

export function ContactSalesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const email = env.NEXT_PUBLIC_SALES_EMAIL ?? PLACEHOLDERS.email;
  const whatsapp = env.NEXT_PUBLIC_SALES_WHATSAPP ?? PLACEHOLDERS.whatsapp;
  const phone = env.NEXT_PUBLIC_SALES_PHONE ?? PLACEHOLDERS.phone;

  const rows = [
    {
      key: "email",
      label: "Email Us",
      value: email,
      href: `mailto:${email}?subject=${encodeURIComponent("Formless Business plan enquiry")}`,
      icon: Mail,
      tone: "bg-blue-500/15 text-blue-500",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      value: whatsapp,
      href: `https://wa.me/${digits(whatsapp)}?text=${encodeURIComponent("Hi! I'd like to know more about the Formless Business plan.")}`,
      icon: MessageCircle,
      tone: "bg-emerald-500/15 text-emerald-500",
    },
    {
      key: "phone",
      label: "Call Us",
      value: phone,
      href: `tel:${phone.replace(/\s/g, "")}`,
      icon: Phone,
      tone: "bg-purple-500/15 text-purple-500",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Sales</DialogTitle>
          <DialogDescription>
            Tell us what you need and we&apos;ll set up the Business plan for you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <a
                key={r.key}
                href={r.href}
                target={r.key === "whatsapp" ? "_blank" : undefined}
                rel={r.key === "whatsapp" ? "noreferrer" : undefined}
                className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:bg-muted/60"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full ${r.tone}`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block truncate text-sm text-muted-foreground">{r.value}</span>
                </span>
              </a>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
