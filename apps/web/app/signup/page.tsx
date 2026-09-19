// apps/web/app/signup/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { useSignup, useGoogleSignIn } from "~/hooks/api/auth";
import { GoogleSignInButton } from "~/components/google-sign-in-button";
import { Logo } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";
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
      router.push("/dashboard/forms");
    } catch {
      // error is surfaced via the `error` state below
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    try {
      await signInWithGoogleAsync({ idToken });
      router.push("/dashboard/forms");
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    }
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
            <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
            <p className="text-sm text-muted-foreground">
              Register with your name, email, and password.
            </p>
          </div>

          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={isGooglePending} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Doe"
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters, with uppercase, lowercase, a number, and a symbol.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
          {googleError ? <p className="text-sm text-destructive">{googleError.message}</p> : null}
          {isSuccess ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Account created.</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Registering..." : "Register"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
