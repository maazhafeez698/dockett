// apps/web/hooks/api/analytics.ts

import { trpc } from "~/trpc/client";

const ANALYTICS_REFRESH_INTERVAL = 5_000;

function getTimeZone(): string {
  return typeof window === "undefined"
    ? "UTC"
    : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export const useGetFormAnalytics = (formId: string | null) => {
  const {
    data: analytics,
    error,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.analytics.getFormAnalytics.useQuery(
    { formId: formId ?? "", timeZone: getTimeZone() },
    {
      enabled: !!formId,
      retry: false,
      staleTime: 0,
      refetchInterval: ANALYTICS_REFRESH_INTERVAL,
      refetchOnWindowFocus: true,
    },
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
    {
      enabled: !!formId,
      retry: false,
      staleTime: 0,
      refetchInterval: ANALYTICS_REFRESH_INTERVAL,
      refetchOnWindowFocus: true,
    },
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

/**
 * Sum of responses across the given forms — drives the dashboard's REPLIES
 * counter. One (batched) analytics query per form; cached by react-query.
 */
export const useTotalResponses = (formIds: string[]) => {
  const timeZone = getTimeZone();
  const results = trpc.useQueries((t) =>
    formIds.map((formId) => t.analytics.getFormAnalytics({ formId, timeZone }, { retry: false })),
  );

  const total = results.reduce((sum, r) => sum + (r.data?.totalResponses ?? 0), 0);
  const isLoading = results.some((r) => r.isLoading);

  return { total, isLoading };
};
