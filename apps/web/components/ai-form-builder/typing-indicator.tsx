"use client";

import { useEffect, useState } from "react";

const ACTIONS = ["Thinking...", "Analyzing...", "Resolving...", "Designing...", "Checking..."];

export function TypingIndicator({ status }: { status?: string | null }) {
  const [actionIndex, setActionIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActionIndex((index) => (index + 1) % ACTIONS.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div role="status" className="flex flex-col items-start gap-1.5">
      <div aria-hidden="true" className="flex h-4 items-center gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.32s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.16s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current" />
      </div>
      <span className="text-xs text-muted-foreground">{status || ACTIONS[actionIndex]}</span>
    </div>
  );
}
