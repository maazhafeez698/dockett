// apps/web/components/ai-generate-bar.tsx

"use client";

import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";

import { AiFormBuilderPanel } from "~/components/ai-form-builder/panel";

const SUGGESTIONS = [
  "Event RSVP form",
  "Customer feedback survey",
  "Job application",
  "Course enrollment",
];

export function AiGenerateBar() {
  const [prompt, setPrompt] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | undefined>();

  const handleGenerate = () => {
    const text = prompt.trim();
    if (!text) return;
    setPending(text); // the dialog sends it once, as soon as it opens
    setPrompt("");
    setOpen(true);
  };

  return (
    <div className="glass-strong rounded-3xl p-6 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/15">
        <Sparkles className="size-5 text-primary" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Describe a form, and let AI build it</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Or start from a template, or build one field at a time — whatever fits.
      </p>

      <div className="glass mx-auto mt-5 flex max-w-xl items-center gap-2 rounded-2xl p-2 pl-4">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleGenerate()}
          placeholder='Try "Create a customer satisfaction survey"'
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!prompt.trim()}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Generate form"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {s}
          </button>
        ))}
      </div>

      <AiFormBuilderPanel
        open={open}
        onOpenChange={setOpen}
        mode="NEW_FORM"
        initialPrompt={pending}
        onInitialPromptConsumed={() => setPending(undefined)}
      />
    </div>
  );
}
