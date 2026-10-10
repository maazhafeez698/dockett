// apps/web/app/forgot-password/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";

import { useForgotPassword } from "~/hooks/api/auth";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function ForgotPasswordPage() {
  const { forgotPasswordAsync, isPending, isSuccess } = useForgotPassword();
  const [email, setEmail] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Always resolves with a generic success message, whether or not the
    // email is registered — that's intentional, see the backend service.
    await forgotPasswordAsync({ email });
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we'll send you a link to reset your password."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSuccess ? (
          <p className="text-xs text-success" role="status">
            If an account exists for that email, a reset link has been sent.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending..." : "Send reset link"}
            </Button>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/signin" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
