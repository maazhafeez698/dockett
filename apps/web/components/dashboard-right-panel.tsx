"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { VoiceCard } from "~/components/voice-card";
import { ContactSalesDialog } from "~/components/billing/contact-sales-dialog";
import { useCreateFormFromTemplate } from "~/hooks/api/form";
import { useBillingOverview } from "~/hooks/api/billing";
import { FORM_TEMPLATES } from "~/lib/templates-data";
import { toastError } from "~/lib/plan-limit";

interface DashboardRightPanelProps {
  /** Opens the AI builder with this prompt. */
  onAiPrompt: (prompt: string) => void;
}

function UpgradeCard() {
  return (
    <section className="border border-foreground/70 bg-card p-3.5" aria-label="Upgrade to Dockett Pro">
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
        Dockett Pro
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        More active forms, advanced analytics, Pro themes and increased AI usage.
      </p>
      <Link
        href="/dashboard/billing"
        className="mono-label mt-3 flex h-9 items-center justify-center gap-1.5 rounded-[3px] bg-solid text-solid-foreground transition-opacity hover:opacity-85"
      >
        Upgrade to Pro <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}

function BusinessCard({ onContact }: { onContact: () => void }) {
  return (
    <section className="border border-foreground/70 bg-card p-3.5" aria-label="Dockett Business">
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
        Dockett Business
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        Unlimited forms and responses, dedicated support and custom needs for your team.
      </p>
      <button
        type="button"
        onClick={onContact}
        className="mono-label mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[3px] bg-solid text-solid-foreground transition-opacity hover:opacity-85"
      >
        Contact sales <ArrowRight className="size-3.5" />
      </button>
    </section>
  );
}

export function DashboardRightPanel({ onAiPrompt }: DashboardRightPanelProps) {
  const router = useRouter();
  const { createFormFromTemplateAsync } = useCreateFormFromTemplate();
  const { overview } = useBillingOverview();
  const [contactOpen, setContactOpen] = useState(false);

  // Basic → Pro card. Pro → Business card (opens the contact-sales popup).
  // Business → nothing. Hidden while the plan is loading so nothing flashes.
  const planKey = overview?.plan.key;
  const showUpgrade = planKey === "basic";
  const showBusiness = planKey === "premium"; // "premium" is the internal key of the Pro plan

  const handleBugReport = async () => {
    const t = FORM_TEMPLATES.find((x) => x.id === "developer-bug-report");
    if (!t) return;
    try {
      const { id } = await createFormFromTemplateAsync({
        title: t.name,
        description: t.description,
        template: t.template,
        submissionLayout: "ONE_AT_A_TIME",
        fields: t.fields,
      });
      toast.success("Bug Report created — one question at a time.");
      router.push(`/dashboard/forms/${id}`);
    } catch (err) {
      toastError(err, "Couldn't create the form", () => router.push("/dashboard/billing"));
    }
  };

  const requests: { label: string; onClick: () => void }[] = [
    { label: "Build a form from my last survey", onClick: () => onAiPrompt("Build a form from my last survey") },
    { label: "Summarize this week's responses", onClick: () => router.push("/dashboard/analytics") },
    { label: "Make “Bug Report” one question at a time", onClick: handleBugReport },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="border border-border bg-card p-3.5" aria-label="Quick requests">
        <h3 className="text-sm font-bold">Quick requests</h3>
        <ul className="mt-2">
          {requests.map((r) => (
            <li key={r.label} className="border-b border-dashed border-border last:border-b-0">
              <button
                type="button"
                onClick={r.onClick}
                className="group flex w-full items-center justify-between gap-2 py-2 text-left font-mono text-[10px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>{r.label}</span>
                <ArrowRight className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <VoiceCard onTranscript={onAiPrompt} />

      {showUpgrade ? <UpgradeCard /> : null}
      {showBusiness ? <BusinessCard onContact={() => setContactOpen(true)} /> : null}
      <ContactSalesDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}
