// apps/web/hooks/api/analytics.ts

import { trpc } from "~/trpc/client";

export const useGetFormAnalytics = (formId: string | null) => {
  const {
    data: analytics,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.analytics.getFormAnalytics.useQuery(
    { formId: formId ?? "" },
    { enabled: !!formId, retry: false },
  );

  return { analytics, error, isFetched, isFetching, isLoading, status };
};

export const useListSubmissions = (formId: string | null) => {
  const {
    data: submissions,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.analytics.listSubmissions.useQuery(
    { formId: formId ?? "" },
    { enabled: !!formId, retry: false },
  );

  return { submissions, error, isFetched, isFetching, isLoading, status };
};

/** Imperative fetch (not a live query) — only pulled when the user actually
 * clicks Export, since it's the one endpoint that returns every answer for
 * every submission and there's no reason to keep it warm in the cache. */
export const useExportData = () => {
  const utils = trpc.useUtils();
  return {
    fetchExportData: (formId: string) => utils.analytics.getExportData.fetch({ formId }),
  };
};

export const useGetSubmissionDetail = (submissionId: string | null) => {
  const {
    data: detail,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.analytics.getSubmissionDetail.useQuery(
    { submissionId: submissionId ?? "" },
    { enabled: !!submissionId, retry: false },
  );

  return { detail, error, isFetched, isFetching, isLoading, status };
};
