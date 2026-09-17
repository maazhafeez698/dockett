"use client";

import { useEffect, useRef } from "react";
import { env } from "~/env.js";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onCredential, disabled }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || disabled) return;

    let cancelled = false;

    function render() {
      if (cancelled || !buttonRef.current || !window.google) return;

      window.google.accounts.id.initialize({
        client_id: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: (response) => onCredential(response.credential),
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    }

    const existingScript = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existingScript) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [onCredential, disabled]);

  if (!env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex w-full justify-center" />;
}
