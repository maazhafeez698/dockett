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
          <div className="inline-flex rounded-full border border-border bg-muted/40 p-1 text-sm">
            {(["month", "year"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {c === "month" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
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
                <Button variant="outline" className="w-full" onClick={onManage} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Manage
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
                <Button className="w-full" onClick={() => onUpgrade(cycle)} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Upgrade to Premium
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
              className={`relative flex flex-col rounded-2xl border p-6 ${featured ? "border-primary/60 bg-card/70 shadow-lg" : "border-border bg-card/40"}`}
            >
              {featured ? (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{pr.main}</span>
                <span className="text-sm text-muted-foreground">{pr.suffix}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.highlights.map((h) => (
                  <li key={h.text} className="flex items-start gap-2 text-sm">
                    {h.soon ? (
                      <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    )}
                    <span className={h.soon ? "text-muted-foreground" : ""}>
                      {h.text}
                      {h.soon ? (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
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
