"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { useSignin, useGoogleSignIn } from "~/hooks/api/auth";
import { GoogleSignInButton } from "~/components/google-sign-in-button";
import { AuthShell, OrDivider, safeNext } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { VerifyEmailPanel } from "~/components/verify-email-panel";

export default function SigninPage() {
  const router = useRouter();
  const { signInUserWithEmailAndPasswordAsync, isPending, isSuccess, error } = useSignin();
  const {
    signInWithGoogleAsync,
    isPending: isGooglePending,
    error: googleError,
  } = useGoogleSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // The server answers FORBIDDEN (correct password, address not verified yet).
  const unverified = (error as { data?: { code?: string } } | null)?.data?.code === "FORBIDDEN";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await signInUserWithEmailAndPasswordAsync({ email, password });
      router.push(safeNext());
    } catch {
      // error is surfaced via the `error` state below
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    try {
      await signInWithGoogleAsync({ idToken });
      router.push(safeNext());
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Enter your email and password to continue."
    >
      <form onSubmit={handleSubmit} className="space-y-4">

          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isGooglePending} />

          <OrDivider />

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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="mono-label-sm text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>

          {unverified ? (
            <VerifyEmailPanel email={email} variant="inline" />
          ) : error ? (
            <p role="alert" className="text-xs text-destructive">
              {error.message}
            </p>
          ) : null}
          {googleError ? <p role="alert" className="text-xs text-destructive">{googleError.message}</p> : null}
          {isSuccess ? (
            <p className="text-xs text-success">Signed in.</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
    </AuthShell>
  );
}
