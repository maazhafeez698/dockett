"use client";

import { useState } from "react";
import { Check, Clock, Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import type { RouterOutputs } from "@repo/trpc/client";

type Overview = RouterOutputs["billing"]["getOverview"];
export type BillingCycle = "month" | "year";

interface PricingPlansProps {
  overview: Overview;
  busy: boolean;
  onUpgrade(cycle: BillingCycle): void;
  onManage(): void;
  onContactSales(): void;
}

function price(planKey: string, usd: number | null, cycle: BillingCycle) {
  if (planKey === "business") return { main: "Custom", suffix: "" };
  return { main: `$${usd ?? 0}`, suffix: cycle === "year" ? "/yr" : "/mo" };
}

export function PricingPlans({
  overview,
  busy,
  onUpgrade,
  onManage,
  onContactSales,
}: PricingPlansProps) {
  const [cycle, setCycle] = useState<BillingCycle>("month");
  const yearlyOffered =
    !!overview.checkout.premiumYearlyPriceId && overview.plans.some((p) => p.priceYearlyUsd);
  const current = overview.plan.key;
  const managed = overview.subscription?.managedByPaddle ?? false;

  return (
    <div className="space-y-6">
      {yearlyOffered ? (
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex border border-foreground/70 p-0.5">
            {(["month", "year"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                aria-pressed={cycle === c}
                className={`mono-label-sm rounded-[2px] px-4 py-2 transition-colors ${cycle === c ? "bg-solid text-solid-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {c === "month" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <span className="mono-label-sm border border-success/60 px-2 py-1 text-success">
            SAVE 16%
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {overview.plans.map((p) => {
          const isCurrent = p.key === current;
          const pr = price(p.key, cycle === "year" ? p.priceYearlyUsd : p.priceMonthlyUsd, cycle);
          const featured = p.key === "premium";

          let action: React.ReactNode;
          if (p.key === "basic") {
            action = (
              <Button variant="outline" disabled className="w-full">
                {isCurrent ? "Current plan" : "Free plan"}
              </Button>
            );
          } else if (p.key === "premium") {
            if (isCurrent) {
              action = managed ? (
                <Button className="w-full" onClick={onManage} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}Manage
                  subscription
                </Button>
              ) : (
                <Button variant="outline" disabled className="w-full">
                  Current plan
                </Button>
              );
            } else if (current === "business") {
              action = (
                <Button variant="outline" disabled className="w-full">
                  Included in Business
                </Button>
              );
            } else if (!overview.checkout.available) {
              action = (
                <Button variant="outline" disabled className="w-full">
                  Payments aren&apos;t set up yet
                </Button>
              );
            } else {
              action = (
                <Button variant="ember" className="w-full" onClick={() => onUpgrade(cycle)} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}Upgrade to Pro
                </Button>
              );
            }
          } else {
            action = isCurrent ? (
              <Button variant="outline" disabled className="w-full">
                Current plan
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={onContactSales}>
                Contact Sales
              </Button>
            );
          }

          return (
            <div
              key={p.key}
              className={`relative flex flex-col bg-card p-5 ${featured ? "border-2 border-primary shadow-[4px_4px_0_0_var(--hard-shadow)]" : "border border-border"}`}
            >
              {featured ? (
                <span className="mono-label-sm absolute -top-2.5 left-4 border border-foreground/70 bg-card px-2 py-1">
                  Most popular
                </span>
              ) : null}
              <h3 className="font-display text-3xl leading-none font-extrabold">{p.name}</h3>
              <p className="mt-2 min-h-[2.5rem] text-xs text-muted-foreground">{p.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl leading-none font-extrabold">{pr.main}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{pr.suffix}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.highlights.map((h) => (
                  <li key={h.text} className="flex items-start gap-2 font-mono text-[11px] leading-snug">
                    {h.soon ? (
                      <Clock className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Check className="mt-px size-3.5 shrink-0 text-primary" />
                    )}
                    <span className={h.soon ? "text-muted-foreground" : ""}>
                      {h.text}
                      {h.soon ? (
                        <span className="mono-label-sm ml-2 border border-border px-1.5 py-0.5">
                          Coming soon
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">{action}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
