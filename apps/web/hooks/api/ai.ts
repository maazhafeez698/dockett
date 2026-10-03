import { trpc } from "~/trpc/client";

export function useAiUsage(enabled = true) {
  const {
    data: usage,
    error,
    isLoading,
    refetch,
  } = trpc.ai.getUsage.useQuery(undefined, {
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
  return { usage, error, isLoading, refetch };
}

/** Dashboard flow: approve → a brand-new form is created from the draft. */
export function useSaveAiDraft() {
  const utils = trpc.useUtils();
  const { mutateAsync: saveDraftAsync, isPending } = trpc.ai.saveDraftAsForm.useMutation({
    onSuccess: async () => {
      await utils.form.invalidate();
    },
  });
  return { saveDraftAsync, isPending };
}

/** Builder flow: approve → the draft lands on the open canvas. */
export function useApplyAiDraft(formId: string) {
  const utils = trpc.useUtils();
  const { mutateAsync: applyDraftAsync, isPending } = trpc.ai.applyDraftToForm.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.formField.getFields.invalidate({ formId }),
        utils.form.invalidate(),
      ]);
    },
  });
  return { applyDraftAsync, isPending };
}
