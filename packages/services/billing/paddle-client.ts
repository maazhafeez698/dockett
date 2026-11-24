import type { BillingConfig } from "./config";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface PortalLinks {
  overview: string;
  cancel?: string;
  updatePaymentMethod?: string;
}

export class PaddleApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaddleApiError";
  }
}

export class PaddleClient {
  constructor(
    private readonly cfg: Pick<BillingConfig, "apiBaseUrl" | "apiKey">,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
  ) {}

  async createPortalSession(customerId: string, subscriptionIds: string[]): Promise<PortalLinks> {
    if (!this.cfg.apiKey) throw new PaddleApiError("Paddle API key is not configured");

    const res = await this.fetchImpl(`${this.cfg.apiBaseUrl}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.cfg.apiKey}`,
        "content-type": "application/json",
        "paddle-version": "1",
      },
      body: JSON.stringify({ subscription_ids: subscriptionIds }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Never echo the response body: it can contain customer details.
      throw new PaddleApiError(`Paddle portal request failed (HTTP ${res.status})`, res.status);
    }

    const json = (await res.json()) as {
      data?: { urls?: { general?: { overview?: string }; subscriptions?: Array<{ cancel_subscription?: string; update_subscription_payment_method?: string }> } };
    };
    const overview = json.data?.urls?.general?.overview;
    if (!overview) throw new PaddleApiError("Paddle returned no portal link");
    const sub = json.data?.urls?.subscriptions?.[0];
    return { overview, cancel: sub?.cancel_subscription, updatePaymentMethod: sub?.update_subscription_payment_method };
  }
}
