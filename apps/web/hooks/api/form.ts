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

export const useGetFormWithFields = (formId: string) => {
  const {
    data: form,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.form.getFormWithFields.useQuery({ formId });

  return {
    form,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  };
};

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
