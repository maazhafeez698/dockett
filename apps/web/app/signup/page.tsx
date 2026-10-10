// apps/web/app/signup/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { useSignup, useGoogleSignIn } from "~/hooks/api/auth";
import { GoogleSignInButton } from "~/components/google-sign-in-button";
import { AuthShell, OrDivider, safeNext } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const { createUserWithEmailAndPasswordAsync, isPending, isSuccess, error } = useSignup();
  const {
    signInWithGoogleAsync,
    isPending: isGooglePending,
    error: googleError,
  } = useGoogleSignIn();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createUserWithEmailAndPasswordAsync({ fullName, email, password });
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
      title="Create account"
      subtitle="Register with your name, email, and password."
    >
      <form onSubmit={handleSubmit} className="space-y-4">

          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isGooglePending} />

          <OrDivider />

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Doe"
            />
          </div>

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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            <p className="font-mono text-[10px] leading-snug text-muted-foreground">
              At least 8 characters, with uppercase, lowercase, a number, and a symbol.
            </p>
          </div>

          {error ? <p role="alert" className="text-xs text-destructive">{error.message}</p> : null}
          {googleError ? <p role="alert" className="text-xs text-destructive">{googleError.message}</p> : null}
          {isSuccess ? (
            <p className="text-xs text-success">Account created.</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Registering..." : "Register"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/signin" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
    </AuthShell>
  );
}
