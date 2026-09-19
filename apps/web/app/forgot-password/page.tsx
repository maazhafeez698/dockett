// apps/web/app/forgot-password/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";

import { useForgotPassword } from "~/hooks/api/auth";
import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";
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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <form onSubmit={handleSubmit} className="glass-strong space-y-5 rounded-2xl p-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {isSuccess ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              If an account exists for that email, a reset link has been sent.
            </p>
          ) : (
            <>
              <div className="space-y-2">
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

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/signin" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
