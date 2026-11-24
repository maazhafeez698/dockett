import { trpc } from "~/trpc/client";

// The user's plan, limits, usage and checkout details. Refetches when the tab regains focus (after Paddle's overlay). 
export function useBillingOverview(enabled = true) {
  const {
    data: overview,
    error,
    isLoading,
    refetch,
  } = trpc.billing.getOverview.useQuery(undefined, {
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  return { overview, error, isLoading, refetch };
}

export function useCreatePortalSession() {
  const { mutateAsync: createPortalSessionAsync, isPending } =
    trpc.billing.createPortalSession.useMutation();
  return { createPortalSessionAsync, isPending };
}
