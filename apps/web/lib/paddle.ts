// apps/web/lib/paddle.ts
//
// Loads Paddle.js (Paddle's hosted checkout) on demand and opens the checkout overlay.
// Nothing here decides what plan a user has — only a verified Paddle webhook on the server does.

const SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

interface PaddleGlobal {
  Environment: { set(env: "sandbox" | "production"): void };
  Initialize(opts: { token: string; eventCallback?: (e: { name?: string }) => void }): void;
  Checkout: {
    open(opts: {
      items: Array<{ priceId: string; quantity: number }>;
      customer?: { email: string };
      customData?: Record<string, string>;
      settings?: { displayMode?: "overlay" | "inline"; theme?: "light" | "dark"; variant?: string };
    }): void;
    close(): void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

let loading: Promise<PaddleGlobal> | null = null;
let initializedFor: string | null = null;
let onCompleted: (() => void) | null = null;

function loadScript(): Promise<PaddleGlobal> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Paddle can only load in the browser"));
  if (window.Paddle) return Promise.resolve(window.Paddle);
  loading ??= new Promise<PaddleGlobal>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () =>
      window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle failed to initialise"));
    s.onerror = () => {
      loading = null; // allow a retry
      reject(new Error("Couldn't load the payment window. Check your connection or ad blocker."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface CheckoutParams {
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
  email: string;
  customData: { userId: string; sig: string };
  theme: "light" | "dark";
  /** Called once Paddle reports the payment went through (the plan itself updates via webhook). */
  onCompleted: () => void;
}

export async function openPremiumCheckout(p: CheckoutParams): Promise<void> {
  const paddle = await loadScript();
  onCompleted = p.onCompleted;

  const key = `${p.environment}:${p.clientToken}`;
  if (initializedFor !== key) {
    if (p.environment === "sandbox") paddle.Environment.set("sandbox");
    paddle.Initialize({
      token: p.clientToken,
      eventCallback: (e) => {
        if (e?.name === "checkout.completed") onCompleted?.();
      },
    });
    initializedFor = key;
  }

  paddle.Checkout.open({
    items: [{ priceId: p.priceId, quantity: 1 }],
    customer: { email: p.email },
    customData: p.customData,
    settings: { displayMode: "overlay", theme: p.theme },
  });
}

export function closeCheckout(): void {
  window.Paddle?.Checkout.close();
}
