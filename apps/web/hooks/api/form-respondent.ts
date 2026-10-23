import { trpc } from "~/trpc/client";

/** Magic-link email verification for respondents of "verified email" forms. */
export function useRequestRespondentLink() {
  const { mutateAsync: requestLinkAsync, isPending, error } = trpc.formRespondent.requestLink.useMutation();
  return { requestLinkAsync, isPending, error };
}

export function useVerifyRespondentLink() {
  const { mutateAsync: verifyLinkAsync, isPending } = trpc.formRespondent.verifyLink.useMutation();
  return { verifyLinkAsync, isPending };
}

export function useCheckRespondentSession() {
  const { mutateAsync: checkSessionAsync, isPending } = trpc.formRespondent.checkSession.useMutation();
  return { checkSessionAsync, isPending };
}
