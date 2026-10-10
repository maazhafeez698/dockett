// apps/web/app/reset-password/page.tsx

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { useResetPassword } from "~/hooks/api/auth";
import { AuthShell } from "~/components/auth-shell";
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
      <p className="text-xs text-destructive">
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
        <p className="text-xs text-success">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Button onClick={() => router.push("/signin")} className="w-full">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="••••••••"
        />
        <p className="font-mono text-[10px] leading-snug text-muted-foreground">
          At least 8 characters, with uppercase, lowercase, a number, and a symbol.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
        />
      </div>

      {mismatch ? <p className="text-xs text-destructive">Passwords don&apos;t match.</p> : null}
      {error ? <p className="text-xs text-destructive">{error.message}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
      <Suspense fallback={<p className="text-xs text-muted-foreground">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
