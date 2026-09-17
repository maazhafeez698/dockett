// apps/web/app/forgot-password/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";

import { useForgotPassword } from "~/hooks/api/auth";
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
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
          <p className="text-sm text-white/60">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {isSuccess ? (
          <p className="text-sm text-emerald-400">
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
                className="bg-black/40 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={isPending}
            >
              {isPending ? "Sending..." : "Send reset link"}
            </Button>
          </>
        )}

        <p className="text-center text-sm text-white/50">
          <Link href="/signin" className="text-white hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
