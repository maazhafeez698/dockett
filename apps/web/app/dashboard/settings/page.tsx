// apps/web/app/dashboard/settings/page.tsx

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useUser, useSetPassword, useLogout } from "~/hooks/api/auth";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { setPasswordAsync, isPending, isSuccess, error } = useSetPassword();
  const { logoutAsync } = useLogout();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setPasswordAsync({
        currentPassword: currentPassword.trim() ? currentPassword : undefined,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      // surfaced via `error` below
    }
  };

  const handleLogout = async () => {
    await logoutAsync();
    router.push("/signin");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile & Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>
        </div>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Account</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Name</div>
                <div className="text-sm">{user?.fullName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm">{user?.email}</div>
              </div>
            </div>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Password</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Leave current password blank if you signed up with Google and haven't set one yet.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password (if set)</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
            {isSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated.</p>
            ) : null}

            <Button type="submit" disabled={isPending || !newPassword}>
              {isPending ? "Saving..." : "Update password"}
            </Button>
          </form>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Session</h2>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
