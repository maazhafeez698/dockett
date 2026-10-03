"use client";

import type { AiCredits } from "~/lib/ai-stream";
import { formatReset } from "./shared";

/** Prompt-weighted credit usage strip shown above the chat. */
export function CreditsBar({ credits, now }: { credits: AiCredits | null; now: number }) {
  if (!credits) return <div className="h-[34px] border-b border-border/60" aria-hidden />;

  const pct = credits.percentUsed;
  const reset = credits.limitReached ? formatReset(credits.resetsAt, now) : null;
  const tone = credits.limitReached ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <div
      className="border-b border-border/60 px-4 py-2"
      title={`${credits.tokensUsed.toLocaleString()} of ${credits.tokensLimit.toLocaleString()} tokens used in this window`}
    >
      <div className="mb-1 flex items-center justify-between text-[11px]">
        {credits.limitReached ? (
          <span className="font-medium text-destructive">Limit reached</span>
        ) : (
          <span className="text-muted-foreground">
            <span className={pct >= 80 ? "font-medium text-amber-500" : "font-medium text-foreground"}>{pct}%</span> credits consumed
          </span>
        )}
        {reset ? <span className="text-muted-foreground">resets in {reset}</span> : null}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Credits consumed">
        <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
      </div>
    </div>
  );
}
