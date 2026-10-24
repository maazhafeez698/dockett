"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { useAuthGuard } from "~/hooks/use-auth-guard";
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
  const { ready } = useAuthGuard();
  const { overview, isLoading, error, refetch } = useBillingOverview(ready);
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

  if (!ready) return null;

  const formLimit = overview?.plan.maxActiveForms ?? null;
  const usagePct =
    overview && formLimit ? Math.min(100, Math.round((overview.usage.activeForms / formLimit) * 100)) : 0;

  return (
    <AppShell docLabel="Plans & billing">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-3 sm:p-4 lg:p-5">
        <div>
          <h1 className="font-display text-4xl font-extrabold text-primary">Plans &amp; Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your plan decides how many forms and responses you can have. Changes apply instantly.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !overview ? (
          <p role="alert" className="border border-destructive/50 bg-destructive/10 p-4 text-sm">
            Couldn&apos;t load your plan. Please refresh.
          </p>
        ) : (
          <>
            {activating ? (
              <div className="flex items-center gap-3 border border-primary/50 bg-primary/10 p-4 text-sm">
                <Loader2 className="size-4 animate-spin" /> Activating your plan — this takes a few
                seconds…
              </div>
            ) : null}

            {sub?.status === "PAST_DUE" ? (
              <div className="flex items-start gap-3 border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
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
              <div className="flex items-start gap-3 border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <p>
                  Your {overview.plan.name} plan allows {limitText(overview.plan.maxActiveForms)}{" "}
                  active forms, so <b>{overview.usage.suspendedForms}</b> published form
                  {overview.usage.suspendedForms === 1 ? " is" : "s are"} suspended (your oldest
                  forms stay live). Close some forms or upgrade to bring them back.
                </p>
              </div>
            ) : null}

            <section
              className="grid items-end gap-5 border border-foreground/70 bg-card p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
              aria-label="Current plan"
            >
              <div>
                <p className="mono-label-sm text-muted-foreground">Current plan</p>
                <p className="font-display mt-1 text-2xl leading-none font-extrabold text-primary">
                  {overview.plan.name}
                </p>
                {sub && sub.status !== "CANCELED" && sub.currentPeriodEnd ? (
                  <p className="mono-label-sm mt-1.5 text-muted-foreground">
                    {sub.cancelAtPeriodEnd
                      ? `Ends ${fmt(sub.currentPeriodEnd)}`
                      : `Renews ${fmt(sub.currentPeriodEnd)}`}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mono-label-sm text-muted-foreground">Active forms</p>
                <p className="font-display mt-1 text-2xl leading-none font-extrabold">
                  <span className="text-primary">{overview.usage.activeForms}</span>
                  <span className="text-base font-bold text-muted-foreground"> / {limitText(overview.plan.maxActiveForms)}</span>
                </p>
                {formLimit ? (
                  <div
                    className="mt-2 h-1 w-full max-w-[160px] bg-foreground/15"
                    role="progressbar"
                    aria-valuenow={usagePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Active forms used"
                  >
                    <div className="h-full bg-primary" style={{ width: `${usagePct}%` }} />
                  </div>
                ) : null}
              </div>
              <div>
                <p className="mono-label-sm text-muted-foreground">Responses / form / mo</p>
                <p className="font-display mt-1 text-2xl leading-none font-extrabold">
                  {limitText(overview.plan.maxResponsesPerFormPerMonth)}
                </p>
              </div>
              {sub?.managedByPaddle ? (
                <Button onClick={handleManage} disabled={portalPending}>
                  {portalPending ? <Loader2 className="animate-spin" /> : null}
                  Manage subscription
                </Button>
              ) : null}
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
