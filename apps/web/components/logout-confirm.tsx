"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useLogout } from "~/hooks/api/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

interface LogoutConfirmProps {
  // The clickable trigger — a button, a nav row, etc. 
  children: ReactNode;
}

export function LogoutConfirm({ children }: LogoutConfirmProps) {
  const router = useRouter();
  const { logoutAsync, isPending } = useLogout();
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await logoutAsync();
    router.push("/");
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to sign in again to get back to your forms.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? "Signing out…" : "Sign out"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
