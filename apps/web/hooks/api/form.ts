import { trpc } from "~/trpc/client";

export function useCreateForm() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createFormAsync,
    mutate: createForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  } = trpc.form.createForm.useMutation({
    onSuccess: async () => {
      await utils.form.invalidate();
    },
  });

  return {
    createFormAsync,
    createForm,
    error,
    failureCount,
    isError,
    isIdle,
    isPending,
    isSuccess,
    status,
  };
}

export function useListForms() {
  const {
    data: forms,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.form.listForms.useQuery();

  return {
    forms,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  };
}

export const useGetFormWithFields = (formId: string, accessCode?: string, enabled = true) => {
  const {
    data: form,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
    refetch,
  } = trpc.form.getFormWithFields.useQuery(
    { formId, accessCode },
    { enabled: !!formId && enabled, retry: false },
  );

  return {
    form,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
    refetch,
  };
};

/** Cheap, always-public metadata — fetched first so the fill page can
 * decide which gate (if any) to show before attempting getFormWithFields. */
export const useGetFormAccessInfo = (formId: string) => {
  const {
    data: accessInfo,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.form.getFormAccessInfo.useQuery({ formId }, { enabled: !!formId, retry: false });

  return { accessInfo, error, isFetched, isFetching, isLoading, status };
};

export function useCreateFormFromTemplate() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createFormFromTemplateAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.form.createFormFromTemplate.useMutation({
    onSuccess: async () => {
      await utils.form.listForms.invalidate();
    },
  });

  return { createFormFromTemplateAsync, error, isError, isSuccess, isPending };
}

export function useRegenerateAccessCode() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: regenerateAccessCodeAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.form.regenerateAccessCode.useMutation({
    onSuccess: async (_, variables) => {
      await utils.form.getFormWithFields.invalidate({ formId: variables.formId });
    },
  });

  return { regenerateAccessCodeAsync, error, isError, isSuccess, isPending };
}

export function useUpdateForm() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: updateFormAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.form.updateForm.useMutation({
    onSuccess: async (_, variables) => {
      await Promise.all([
        utils.form.listForms.invalidate(),
        utils.form.getFormWithFields.invalidate({ formId: variables.formId }),
      ]);
    },
  });

  return { updateFormAsync, error, isError, isSuccess, isPending };
}

export function useDeleteForm() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteFormAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.form.deleteForm.useMutation({
    onSuccess: async () => {
      await utils.form.listForms.invalidate();
    },
  });

  return { deleteFormAsync, error, isError, isSuccess, isPending };
}
