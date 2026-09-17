// apps/web/app/reset-password/page.tsx

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { useResetPassword } from "~/hooks/api/auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { resetPasswordAsync, isPending, isSuccess, error } = useResetPassword();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMismatch(false);

    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }

    await resetPasswordAsync({ token, newPassword });
  };

  if (!token) {
    return (
      <p className="text-sm text-red-400">
        This reset link is missing its token. Request a new one from the{" "}
        <Link href="/forgot-password" className="underline">
          forgot password
        </Link>{" "}
        page.
      </p>
    );
  }

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-400">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Button onClick={() => router.push("/signin")} className="w-full bg-white text-black hover:bg-white/90">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="••••••••"
          className="bg-black/40 border-white/10 text-white placeholder:text-white/30"
        />
        <p className="text-xs text-white/40">
          At least 8 characters, with uppercase, lowercase, a number, and a symbol.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
          className="bg-black/40 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {mismatch ? <p className="text-sm text-red-400">Passwords don&apos;t match.</p> : null}
      {error ? <p className="text-sm text-red-400">{error.message}</p> : null}

      <Button type="submit" className="w-full bg-white text-black hover:bg-white/90" disabled={isPending}>
        {isPending ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-white/60">Choose a new password for your account.</p>
        </div>

        <Suspense fallback={<p className="text-sm text-white/50">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
