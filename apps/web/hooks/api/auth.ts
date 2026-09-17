import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "~/trpc/client";

export function useSignup() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: createUserWithEmailAndPasswordAsync,
    mutate: createUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    isPending,
    status,
  } = trpc.auth.createUserWithEmailAndPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.getLoggedInUserInfo.invalidate();
    },
  });

  return {
    createUserWithEmailAndPasswordAsync,
    createUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    isPending,
    status,
  };
}

export function useSignin() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: signInUserWithEmailAndPasswordAsync,
    mutate: signInUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    isPending,
    status,
  } = trpc.auth.singInUserWithEmailAndPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.getLoggedInUserInfo.invalidate();
    },
  });

  return {
    signInUserWithEmailAndPasswordAsync,
    signInUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    isPending,
    status,
  };
}

export function useGoogleSignIn() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: signInWithGoogleAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.auth.signInWithGoogle.useMutation({
    onSuccess: async () => {
      await utils.auth.getLoggedInUserInfo.invalidate();
    },
  });

  return { signInWithGoogleAsync, error, isError, isSuccess, isPending };
}

export function useUser() {
  const {
    data: user,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.auth.getLoggedInUserInfo.useQuery(undefined, {
    retry: false,
  });

  return {
    user,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();

  const { mutateAsync: logoutMutateAsync, isPending } = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      // Clear every cached query, not just the user — nothing that was
      // scoped to this session should linger after logout.
      queryClient.clear();
    },
  });

  const logoutAsync = () => logoutMutateAsync({});

  return { logoutAsync, isPending };
}

export function useForgotPassword() {
  const { mutateAsync: forgotPasswordAsync, error, isError, isSuccess, isPending } =
    trpc.auth.forgotPassword.useMutation();

  return { forgotPasswordAsync, error, isError, isSuccess, isPending };
}

export function useResetPassword() {
  const { mutateAsync: resetPasswordAsync, error, isError, isSuccess, isPending } =
    trpc.auth.resetPassword.useMutation();

  return { resetPasswordAsync, error, isError, isSuccess, isPending };
}

export function useSetPassword() {
  const utils = trpc.useUtils();

  const {
    mutateAsync: setPasswordAsync,
    error,
    isError,
    isSuccess,
    isPending,
  } = trpc.auth.setPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.getLoggedInUserInfo.invalidate();
    },
  });

  return { setPasswordAsync, error, isError, isSuccess, isPending };
}