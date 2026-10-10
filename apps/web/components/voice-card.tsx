// apps/web/components/voice-card.tsx
//
// "Say something to Dockett" — voice input for the AI builder, using the
// browser's Web Speech API. Where it isn't supported the card says so.

"use client";

import { useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { useVoiceInput } from "~/hooks/use-voice-input";

const BARS = [8, 14, 22, 12, 28, 18, 10, 24, 16, 30, 12, 20, 9, 26, 14, 18, 8, 22, 12, 16];

interface VoiceCardProps {
  onTranscript: (text: string) => void;
}

export function VoiceCard({ onTranscript }: VoiceCardProps) {
  const [recorded, setRecorded] = useState("");
  const voice = useVoiceInput(setRecorded);
  const { listening, supported, transcript } = voice;

  return (
    <section className="border border-border bg-card p-3.5" aria-label="Voice input">
      <span className="mono-label-sm inline-block rounded-[2px] bg-primary px-1.5 py-[3px] text-primary-foreground">
        Voice
      </span>
      <h3 className="font-display mt-2 text-[22px] leading-[1.02] font-extrabold">
        Say something to Dockett
      </h3>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!listening) setRecorded("");
            voice.toggle();
          }}
          disabled={!supported}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Start voice input"}
          className={`flex size-9 shrink-0 items-center justify-center rounded-[3px] transition-all active:translate-y-px disabled:opacity-40 ${
            listening ? "bg-primary text-primary-foreground" : "bg-solid text-solid-foreground"
          }`}
        >
          {listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
        </button>

        <div className="flex h-8 min-w-0 flex-1 items-center gap-[3px]" aria-hidden="true">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] origin-center rounded-[1px] bg-primary ${
                listening ? "animate-wave" : ""
              }`}
              style={{
                height: listening ? 30 : h,
                animationDelay: listening ? `${(i % 7) * 90}ms` : undefined,
                transform: listening ? undefined : undefined,
              }}
            />
          ))}
        </div>
        {!listening && recorded ? (
          <button
            type="button"
            onClick={() => {
              onTranscript(recorded);
              setRecorded("");
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-primary-foreground transition-all hover:brightness-110 active:translate-y-px"
            aria-label="Send voice prompt"
          >
            <ArrowUp className="size-4" />
          </button>
        ) : null}
      </div>

      <p
        className="mono-label-sm mt-2 min-h-[1.2em] truncate text-muted-foreground"
        aria-live="polite"
      >
        {!supported
          ? "Voice isn't supported in this browser"
          : listening
            ? transcript || "Listening…"
            : recorded || "Tap the mic and describe a form"}
      </p>
    </section>
  );
}
