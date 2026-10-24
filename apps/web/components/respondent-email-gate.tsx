"use client";

import { useEffect, useState } from "react";
import { MailCheck, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface RespondentEmailGateProps {
  formTitle: string;
  /** Pre-filled address (e.g. the one an expired link was sent to). */
  initialEmail?: string;
  /** Shown above the form (expired / already used link). */
  notice?: string | null;
  oneResponsePerEmail: boolean;
  requestLink: (email: string) => Promise<void>;
}

const RESEND_WAIT_SECONDS = 30;

export function RespondentEmailGate({
  formTitle,
  initialEmail = "",
  notice,
  oneResponsePerEmail,
  requestLink,
}: RespondentEmailGateProps) {
  const [step, setStep] = useState<"enter" | "sent">("enter");
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e?: React.FormEvent): Promise<boolean> {
    e?.preventDefault();
    const address = email.trim();
    if (!address) return false;
    setBusy(true);
    setError(null);
    try {
      await requestLink(address);
      setStep("sent");
      setWait(RESEND_WAIT_SECONDS);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the email.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-4 border border-foreground/70 bg-card p-8 shadow-[5px_5px_0_0_var(--hard-shadow)]">
        {step === "enter" ? (
          <form onSubmit={send} className="flex flex-col items-center gap-4 text-center">
            <Mail className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-display text-2xl leading-tight font-extrabold">Confirm your email</p>
            <p className="text-sm text-muted-foreground">
              &ldquo;{formTitle}&rdquo; asks you to confirm your email address first. We&apos;ll send a one-time
              link — no account needed.
              {oneResponsePerEmail ? " Each address can respond once." : ""}
            </p>
            {notice ? (
              <p role="status" className="w-full border border-primary/50 bg-primary/10 px-3 py-2 text-xs">
                {notice}
              </p>
            ) : null}
            <div className="w-full space-y-1.5 text-left">
              <Label htmlFor="respondent-email">Your email</Label>
              <Input
                id="respondent-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                autoFocus
                required
              />
            </div>
            {error ? (
              <p role="alert" className="w-full text-left text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={!email.trim() || busy}>
              {busy ? "Sending…" : "Email me a link"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
            <MailCheck className="size-8 text-primary" aria-hidden="true" />
            <p className="font-display text-2xl leading-tight font-extrabold">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a link to <b className="break-all text-foreground">{email.trim()}</b>. Open it to continue.
              You can keep this tab open.
            </p>
            {error ? (
              <p role="alert" className="w-full text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex w-full flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy || wait > 0}
                onClick={() => {
                  void send().then((ok) => ok && toast.success("Another link is on its way."));
                }}
              >
                {wait > 0 ? `Resend in ${wait}s` : busy ? "Sending…" : "Resend link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  // Wrong address? Go back. The earlier link is replaced as soon as a new one is requested.
                  setStep("enter");
                  setError(null);
                }}
              >
                Use a different email
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
