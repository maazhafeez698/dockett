// apps/web/app/dashboard/billing/page.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { ContactSalesDialog } from "~/components/billing/contact-sales-dialog";
import { PricingPlans, type BillingCycle } from "~/components/billing/pricing-plans";
import { Button } from "~/components/ui/button";
import { useBillingOverview, useCreatePortalSession } from "~/hooks/api/billing";
import { openPremiumCheckout, closeCheckout } from "~/lib/paddle";

function fmt(iso: string | null | undefined) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
}

export default function BillingPage() {
  const { overview, isLoading, error, refetch } = useBillingOverview();
  const { createPortalSessionAsync, isPending: portalPending } = useCreatePortalSession();
  const [contactOpen, setContactOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [activating, setActivating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  // The plan changes when Paddle's webhook reaches our server, a moment after the payment. Poll until it does.
  const waitForActivation = useCallback(() => {
    stopPolling();
    setActivating(true);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      const { data } = await refetch();
      if (data && data.plan.key !== "basic") {
        stopPolling();
        setActivating(false);
        toast.success(`Welcome to ${data.plan.name}! Your new limits are active.`);
      } else if (tries >= 30) {
        stopPolling();
        setActivating(false);
        toast.message(
          "Payment received — your plan will activate in a minute. Refresh if it doesn't.",
        );
      }
    }, 2000);
  }, [refetch, stopPolling]);

  const handleUpgrade = async (cycle: BillingCycle) => {
    if (!overview) return;
    const c = overview.checkout;
    const priceId = cycle === "year" ? c.premiumYearlyPriceId : c.premiumMonthlyPriceId;
    if (!c.available || !c.clientToken || !c.customData || !priceId) {
      toast.error("Payments aren't set up yet.");
      return;
    }
    setOpening(true);
    try {
      await openPremiumCheckout({
        environment: c.environment,
        clientToken: c.clientToken,
        priceId,
        email: c.customer.email,
        customData: c.customData,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        onCompleted: () => {
          closeCheckout();
          toast.success("Payment received — activating your plan…");
          waitForActivation();
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open checkout");
    } finally {
      setOpening(false);
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await createPortalSessionAsync();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the billing portal");
    }
  };

  const sub = overview?.subscription;
  const limitText = (n: number | null) => (n === null ? "Unlimited" : n.toLocaleString());

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 overflow-y-auto px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans &amp; Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your plan decides how many forms and responses you can have. Changes apply instantly.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !overview ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Couldn&apos;t load your plan. Please refresh.
          </p>
        ) : (
          <>
            {activating ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
                <Loader2 className="size-4 animate-spin" /> Activating your plan — this takes a few
                seconds…
              </div>
            ) : null}

            {sub?.status === "PAST_DUE" ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">We couldn&apos;t renew your subscription.</p>
                  <p className="text-muted-foreground">
                    Update your payment method{sub.graceUntil ? ` by ${fmt(sub.graceUntil)}` : ""}{" "}
                    to keep your {overview.plan.name} plan.
                  </p>
                  {sub.managedByPaddle ? (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={handleManage}
                      disabled={portalPending}
                    >
                      Update payment method
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {overview.usage.suspendedForms > 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <p>
                  Your {overview.plan.name} plan allows {limitText(overview.plan.maxActiveForms)}{" "}
                  active forms, so <b>{overview.usage.suspendedForms}</b> published form
                  {overview.usage.suspendedForms === 1 ? " is" : "s are"} suspended (your oldest
                  forms stay live). Close some forms or upgrade to bring them back.
                </p>
              </div>
            ) : null}

            <section className="grid gap-4 rounded-2xl border border-border bg-card/40 p-6 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Current plan
                </p>
                <p className="mt-1 text-xl font-semibold">{overview.plan.name}</p>
                {sub && sub.status !== "CANCELED" && sub.currentPeriodEnd ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sub.cancelAtPeriodEnd
                      ? `Ends on ${fmt(sub.currentPeriodEnd)}`
                      : `Renews on ${fmt(sub.currentPeriodEnd)}`}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Active forms
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {overview.usage.activeForms}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {limitText(overview.plan.maxActiveForms)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Responses per form / month
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {limitText(overview.plan.maxResponsesPerFormPerMonth)}
                </p>
                {sub?.managedByPaddle ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleManage}
                    disabled={portalPending}
                  >
                    {portalPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                    Manage subscription
                  </Button>
                ) : null}
              </div>
            </section>

            <PricingPlans
              overview={overview}
              busy={opening || portalPending || activating}
              onUpgrade={handleUpgrade}
              onManage={handleManage}
              onContactSales={() => setContactOpen(true)}
            />
            <p className="text-center text-xs text-muted-foreground">
              Payments are processed securely by Paddle, our merchant of record. Prices are in USD;
              taxes may be added at checkout.
            </p>
          </>
        )}
      </div>
      <ContactSalesDialog open={contactOpen} onOpenChange={setContactOpen} />
    </AppShell>
  );
}
