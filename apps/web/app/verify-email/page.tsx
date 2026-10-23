// apps/web/app/verify-email/page.tsx
//
// The page the verification email links to. Consumes the single-use token, which also signs the
// user in, then sends them straight to the dashboard. Expired / used links offer a fresh one.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useResendVerificationEmail, useVerifyEmail } from "~/hooks/api/auth";

type State = "verifying" | "success" | "EXPIRED" | "USED" | "INVALID" | "error";

const COPY: Record<Exclude<State, "verifying" | "success">, { title: string; body: string }> = {
  EXPIRED: { title: "Link expired", body: "This verification link has expired. Enter your email and we'll send a new one." },
  USED: {
    title: "Link already used",
    body: "This link was already used. If your account is verified you can sign in; otherwise request a new link.",
  },
  INVALID: { title: "Link not valid", body: "We couldn't recognise this link. Enter your email to get a new one." },
  error: { title: "Something went wrong", body: "We couldn't verify your email right now. Try again, or request a new link." },
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const { verifyEmailAsync } = useVerifyEmail();
  const { resendVerificationEmailAsync, isPending: resending } = useResendVerificationEmail();

  const [state, setState] = useState<State>("verifying");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const started = useRef(false); // the token is single-use: never spend it twice (React strict mode)

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    // Don't leave the one-time token in the address bar / history.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setState("INVALID");
      return;
    }

    verifyEmailAsync({ token })
      .then((r) => {
        if (r.status === "OK") {
          setState("success");
          router.replace("/dashboard"); // already signed in by the server
        } else setState(r.status);
      })
      .catch(() => setState("error"));
  }, [verifyEmailAsync, router]);

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resendVerificationEmailAsync({ email });
      setSent(true);
      toast.success("If that address needs verifying, a new link is on its way.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the email.");
    }
  };

  if (state === "verifying" || state === "success") {
    return (
      <AuthShell
        title={state === "success" ? "Email verified" : "Verifying…"}
        subtitle={state === "success" ? "Taking you to your dashboard." : "Confirming your email address."}
      >
        <div className="h-1 w-full overflow-hidden bg-foreground/10" role="status" aria-label="Loading">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      </AuthShell>
    );
  }

  const copy = COPY[state];
  return (
    <AuthShell title={copy.title} subtitle={copy.body}>
      {sent ? (
        <p role="status" className="text-sm text-success">
          If that address needs verifying, a new link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={resend} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!email || resending}>
            {resending ? "Sending…" : "Send a new link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/signin" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
