import { httpLink, httpBatchStreamLink } from "@repo/trpc/client";
import { env } from "~/env.js";

interface CreateTRPCHttpBatchClientClientOpts {
  enableStreaming?: boolean;
}

export function getApiBaseUrl() {
  const trpcUrl = env.NEXT_PUBLIC_API_URL ?? "/trpc";
  return trpcUrl.replace(/\/trpc\/?$/, "");
}

// Dedupe concurrent refresh attempts - several queries can 401 at once
// when the access token expires, and they should all wait on one refresh.
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${getApiBaseUrl()}/api/authentication/refreshAccessToken`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export const createTRPCHttpBatchClientClient = (opts?: CreateTRPCHttpBatchClientClientOpts) => {
  const c = opts?.enableStreaming ? httpBatchStreamLink : httpLink;
  return c({
    url: env.NEXT_PUBLIC_API_URL ?? "/trpc",
    async fetch(url, options) {
      const response = await fetch(url, { ...options, credentials: "include" });

      // Access token expired — try a silent refresh once, then retry the
      // original request. If refresh also fails, the 401 propagates and
      // the app treats the user as logged out.
      const isRefreshCall = String(url).includes("refreshAccessToken");
      if (response.status === 401 && !isRefreshCall) {
        const refreshed = await refreshSession();
        if (refreshed) {
          return fetch(url, { ...options, credentials: "include" });
        }
      }

      return response;
    },
  });
};
