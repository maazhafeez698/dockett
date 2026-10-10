// apps/web/hooks/use-auth-guard.ts
//
// Client-side gate for signed-in pages: while the session is resolving it
// reports `ready: false`; if there is no session it sends the visitor to the
// sign-in page (remembering where they were headed).

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "~/hooks/api/auth";

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading || user) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/signin${next}`);
  }, [isLoading, user, pathname, router]);

  return { ready: !isLoading && !!user, user, isLoading };
}
