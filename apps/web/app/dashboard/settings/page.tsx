// apps/web/app/dashboard/settings/page.tsx

"use client";

import { useState, type FormEvent } from "react";

import { useUser, useSetPassword } from "~/hooks/api/auth";
import { useAuthGuard } from "~/hooks/use-auth-guard";
import { LogoutConfirm } from "~/components/logout-confirm";
import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card p-4 sm:p-5">
      <h2 className="mono-label-sm mb-3 border-b border-dashed border-border pb-2 text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { ready } = useAuthGuard();
  const { user, isLoading } = useUser();
  const { setPasswordAsync, isPending, isSuccess, error } = useSetPassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setPasswordAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      // surfaced via `error` below
    }
  };

  if (!ready) return null;

  return (
    <AppShell docLabel="Settings">
      <div className="mx-auto max-w-2xl space-y-4 p-3 sm:p-4 lg:p-5">
        <div>
          <h1 className="font-display text-4xl font-extrabold text-primary">Profile &amp; Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>
        </div>

        <Card title="Account">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="flex items-center gap-4">
              <div
                aria-hidden="true"
                className="font-display flex size-14 shrink-0 items-center justify-center rounded-[3px] bg-primary text-2xl font-extrabold text-primary-foreground"
              >
                {(user?.fullName ?? user?.email ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-2xl leading-tight font-extrabold">
                  {user?.fullName}
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground">{user?.email}</div>
              </div>
              {user && !user.hasPassword ? (
                <span className="mono-label-sm hidden border border-foreground/60 px-2 py-1.5 sm:inline">
                  G · Google sign-in
                </span>
              ) : null}
            </div>
          )}
        </Card>

        <Card title="Password">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !user?.hasPassword ? (
            <p className="text-sm text-muted-foreground">
              This account uses Google sign-in. There&apos;s no password to change.
            </p>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                Enter your current password to set a new one.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {error ? (
                  <p role="alert" className="text-xs text-destructive">
                    {error.message}
                  </p>
                ) : null}
                {isSuccess ? (
                  <p role="status" className="text-xs text-success">
                    Password updated.
                  </p>
                ) : null}

                <Button type="submit" disabled={isPending || !newPassword || !currentPassword}>
                  {isPending ? "Saving..." : "Update password"}
                </Button>
              </form>
            </>
          )}
        </Card>

        <Card title="Session">
          <LogoutConfirm>
            <Button variant="outline">Sign out</Button>
          </LogoutConfirm>
        </Card>
      </div>
    </AppShell>
  );
}
