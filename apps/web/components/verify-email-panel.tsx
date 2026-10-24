"use client";

import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { useResendVerificationEmail } from "~/hooks/api/auth";

const COOLDOWN_SECONDS = 60;

interface VerifyEmailPanelProps {
  email: string;
  /** false: the first email could not be sent (SMTP problem) — nudge the user to resend. */
  initiallySent?: boolean;
  onBack?: () => void;
  backLabel?: string;
  /** "inline": the compact notice used on the sign-in form (nothing was just sent). */
  variant?: "page" | "inline";
}

export function VerifyEmailPanel({ email, initiallySent = true, onBack, backLabel, variant = "page" }: VerifyEmailPanelProps) {
  const { resendVerificationEmailAsync, isPending } = useResendVerificationEmail();
  const [wait, setWait] = useState(initiallySent && variant === "page" ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    try {
      await resendVerificationEmailAsync({ email });
      toast.success("If that address needs verifying, a new link is on its way.");
      setWait(COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resend the email.");
    }
  };

  if (variant === "inline") {
    return (
      <div role="alert" className="space-y-2 border border-primary/50 bg-primary/10 px-3 py-2.5 text-xs">
        <p>
          <b>Verify your email to sign in.</b> We sent a link to {email} when you registered.
        </p>
        <Button type="button" variant="outline" size="sm" disabled={isPending || wait > 0} onClick={resend}>
          {wait > 0 ? `Resend in ${wait}s` : isPending ? "Sending…" : "Resend verification email"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
      <MailCheck className="size-9 text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        {initiallySent ? (
          <>
            We sent a verification link to <b className="break-all text-foreground">{email}</b>. Open it to activate
            your account — you&apos;ll be signed in automatically.
          </>
        ) : (
          <>
            Your account is created, but we couldn&apos;t send the email to{" "}
            <b className="break-all text-foreground">{email}</b>. Use the button below to try again.
          </>
        )}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground">The link works once and expires.</p>
      <div className="flex w-full flex-col gap-2">
        <Button type="button" variant="outline" className="w-full" disabled={isPending || wait > 0} onClick={resend}>
          {wait > 0 ? `Resend in ${wait}s` : isPending ? "Sending…" : "Resend verification email"}
        </Button>
        {onBack ? (
          <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
            {backLabel ?? "Back"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
