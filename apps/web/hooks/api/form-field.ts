import { trpc } from "~/trpc/client";

export function useCreateField(formId: string) {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createFieldAsync,
    mutate: createField,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  } = trpc.formField.createField.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.formField.getFields.invalidate({ formId }),
        utils.form.getFormWithFields.invalidate({ formId }),
      ]);
    },
  });

  return {
    createFieldAsync,
    createField,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  };
}

export function useGetFields(formId: string) {
  const {
    data: fields,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.formField.getFields.useQuery({ formId });

  return {
    fields,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  };
}

export function useUpdateField(formId: string) {
  const utils = trpc.useUtils();

  const {
    mutateAsync: updateFieldAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.formField.updateField.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.formField.getFields.invalidate({ formId }),
        utils.form.getFormWithFields.invalidate({ formId }),
      ]);
    },
  });

  return { updateFieldAsync, error, isError, isSuccess, isPending };
}

export function useDeleteField(formId: string) {
  const utils = trpc.useUtils();

  const {
    mutateAsync: deleteFieldAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.formField.deleteField.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.formField.getFields.invalidate({ formId }),
        utils.form.getFormWithFields.invalidate({ formId }),
      ]);
    },
  });

  return { deleteFieldAsync, error, isError, isSuccess, isPending };
}

export function useReorderFields(formId: string) {
  const utils = trpc.useUtils();

  const {
    mutateAsync: reorderFieldsAsync,
    error,
    isError,
    isPending,
  } = trpc.formField.reorderFields.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.formField.getFields.invalidate({ formId }),
        utils.form.getFormWithFields.invalidate({ formId }),
      ]);
    },
  });

  return { reorderFieldsAsync, error, isError, isPending };
}
