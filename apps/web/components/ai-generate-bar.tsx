"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles } from "lucide-react";

const SUGGESTIONS = ["Event RSVP", "Customer feedback", "Job application", "Course enrollment"];
const SUGGESTION_PROMPTS: Record<string, string> = {
  "Event RSVP": "Event RSVP form",
  "Customer feedback": "Customer feedback survey",
  "Job application": "Job application",
  "Course enrollment": "Course enrollment",
};

interface AiGenerateBarProps {
  onGenerate: (prompt: string) => void;
  onStartBlank?: () => void;
  blankPending?: boolean;
}

export function AiGenerateBar({ onGenerate, onStartBlank, blankPending }: AiGenerateBarProps) {
  const [prompt, setPrompt] = useState("");

  const handleGenerate = () => {
    const text = prompt.trim();
    if (!text) return;
    onGenerate(text);
    setPrompt("");
  };

  return (
    <section className="border border-border bg-card p-5 sm:p-6" aria-labelledby="ai-bar-title">
      <div className="mb-3 flex size-9 items-center justify-center rounded-[3px] bg-primary text-primary-foreground">
        <Sparkles className="size-4" aria-hidden="true" />
      </div>
      <h2
        id="ai-bar-title"
        className="font-display max-w-md text-[28px] leading-[1.02] font-extrabold text-primary sm:text-[34px]"
      >
        Describe a form, and let AI build it
      </h2>

      <div className="mt-5 flex items-center gap-2 border border-foreground/70 bg-background/40 p-1.5 pl-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleGenerate()}
          placeholder='Try "Create a customer satisfaction survey"'
          aria-label="Describe the form you want"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!prompt.trim()}
          className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-primary-foreground transition-all hover:brightness-110 active:translate-y-px disabled:opacity-40"
          aria-label="Generate form"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(SUGGESTION_PROMPTS[s] ?? s)}
            className="mono-label-sm border border-foreground/60 px-2 py-1.5 transition-colors hover:bg-foreground hover:text-background"
          >
            {s}
          </button>
        ))}
      </div>

      {onStartBlank ? (
        <div className="mono-label mt-4 text-muted-foreground">
          Or{" "}
          <button
            type="button"
            onClick={onStartBlank}
            disabled={blankPending}
            className="text-foreground underline underline-offset-4 hover:text-primary disabled:opacity-50"
          >
            {blankPending ? "Creating…" : "start a blank form"}
          </button>{" "}
          ·{" "}
          <Link
            href="/dashboard/templates"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            pick a template
          </Link>
        </div>
      ) : null}
    </section>
  );
}
