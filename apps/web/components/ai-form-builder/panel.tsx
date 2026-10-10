// apps/web/components/ai-form-builder/panel.tsx
//
// The AI Form Builder: a floating chat panel (non-modal, so the canvas stays
// visible behind it). One component, two entry points:
//   NEW_FORM   — dashboard prompt bar. Approve creates the form and opens it in the builder.
//   ADD_FIELDS — builder "AI Generate" button. Approve puts the form on the open canvas.
// Nothing touches the database until the user presses Approve.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Bot, Mic, RotateCcw, Square, X } from "lucide-react";

import { useAiChat } from "~/hooks/use-ai-chat";
import { useVoiceInput } from "~/hooks/use-voice-input";
import { useAiUsage, useApplyAiDraft, useSaveAiDraft } from "~/hooks/api/ai";
import type { AiCredits, AiDraft } from "~/lib/ai-stream";
import { CreditsBar } from "./credits-bar";
import { DraftCard, LiveDraftPreview } from "./draft-card";
import { formatReset } from "./shared";
import { TypingIndicator } from "./typing-indicator";

const WELCOME_NEW =
  "Hi! I'm your AI Form Builder 👋 Tell me what you need — like “a feedback form for my presentation” — and I'll sketch the whole form. You can tweak it before it goes anywhere.";
const WELCOME_ADD =
  "Hi! I'm your AI Form Builder 👋 Tell me what this form is for and I'll lay it out on your canvas — you can review and tweak it first.";

const SUGGESTIONS = [
  "Feedback form for my presentation",
  "Event RSVP with meal choices",
  "Job application",
  "Workshop sign-up",
];

interface AiFormBuilderPanelProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  mode: "NEW_FORM" | "ADD_FIELDS";
  /** Required for ADD_FIELDS. */
  formId?: string;
  /** How many fields the canvas already has (changes the wording: "new form" vs "additions"). */
  existingFieldCount?: number;
  /** Sent automatically the first time the panel opens (dashboard prompt bar). */
  initialPrompt?: string;
  onInitialPromptConsumed?(): void;
}

export function AiFormBuilderPanel({
  open,
  onOpenChange,
  mode,
  formId,
  existingFieldCount = 0,
  initialPrompt,
  onInitialPromptConsumed,
}: AiFormBuilderPanelProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [liveCredits, setLiveCredits] = useState<AiCredits | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);

  const { usage } = useAiUsage(open);
  const { saveDraftAsync, isPending: saving } = useSaveAiDraft();
  const { applyDraftAsync, isPending: applying } = useApplyAiDraft(formId ?? "");

  const chat = useAiChat({ mode, formId, onCredits: setLiveCredits });
  const voice = useVoiceInput((transcript) => {
    if (!open) return;
    setInput((current) =>
      `${current.trim() ? `${current.trim()} ` : ""}${transcript}`.slice(0, maxChars),
    );
  });
  const { listening: voiceListening, stop: stopVoice } = voice;

  // The server is the source of truth; live events from the last message beat the cached query.
  const credits: AiCredits | null =
    liveCredits ??
    (usage
      ? {
          percentUsed: usage.percentUsed,
          limitReached: usage.limitReached,
          resetsAt: usage.resetsAt,
          tokensUsed: usage.tokensUsed,
          tokensLimit: usage.tokensLimit,
        }
      : null);
  const aiOff = usage ? !usage.enabled : false;
  const limitReached = credits?.limitReached ?? false;
  const maxChars = usage?.maxPromptChars ?? 2000;
  const additionsOnly = mode === "ADD_FIELDS" && existingFieldCount > 0;
  const busy = saving || applying;
  const resetText = credits?.limitReached ? formatReset(credits.resetsAt, now) : null;

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open && voiceListening) stopVoice();
  }, [open, voiceListening, stopVoice]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.bubbles, chat.liveFields.length, chat.draft]);

  // Re-arm once the parent has consumed the prompt, so the next dashboard prompt auto-sends too.
  useEffect(() => {
    if (!initialPrompt) initialSent.current = false;
  }, [initialPrompt]);

  // Dashboard flow: fire the prompt the user already typed, exactly once.
  useEffect(() => {
    if (open && initialPrompt && !initialSent.current && !aiOff && usage) {
      initialSent.current = true;
      onInitialPromptConsumed?.();
      void chat.send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, aiOff, usage]);

  const limitMessage = `Limit reached. Your credits reset in ${resetText ?? "a little while"}.`;

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || chat.isStreaming || aiOff) return;
    if (limitReached) {
      chat.notify(limitMessage); // tried to send past the limit: say so, don't call the server, keep their text
      return;
    }
    setInput("");
    const ok = await chat.send(t);
    if (!ok) setInput((cur) => cur || t); // let the user retry without retyping
  };

  const approve = async () => {
    if (!chat.draft || busy) return;
    try {
      if (mode === "NEW_FORM") {
        const { id } = await saveDraftAsync({ draft: chat.draft });
        toast.success("Form created — here it is!");
        chat.reset();
        onOpenChange(false);
        router.push(`/dashboard/forms/${id}`);
      } else if (formId) {
        const { added } = await applyDraftAsync({ formId, draft: chat.draft });
        toast.success(`Added ${added} field${added === 1 ? "" : "s"} to your canvas`);
        chat.markApproved();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that. Please try again.");
    }
  };

  const saveEdits = (d: AiDraft) => {
    chat.setDraft(d);
    toast.success("Changes saved");
  };

  const approveLabel =
    mode === "NEW_FORM" ? "Approve & create" : additionsOnly ? "Approve & add" : "Approve";
  const status = chat.isStreaming ? "Typing…" : limitReached ? "Limit reached" : "Online";

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="AI Form Builder"
      className="fixed left-1/2 top-1/2 z-50 flex h-[min(88dvh,760px)] max-h-[88dvh] w-[calc(100vw-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-foreground/70 bg-card shadow-[6px_6px_0_0_var(--hard-shadow)] sm:w-[440px]"
    >
      <header className="flex items-center gap-3 border-b border-dashed border-border px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/15 text-primary">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight font-extrabold">AI form builder</h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {status}
          </p>
        </div>
        {chat.bubbles.length > 0 && !chat.isStreaming ? (
          <button
            type="button"
            onClick={chat.reset}
            className="rounded-[3px] p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Start over"
            title="Start over"
          >
            <RotateCcw className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-[3px] p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </header>

      <CreditsBar credits={credits} now={now} />

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        <div className="flex justify-start">
          <div className="max-w-[88%] rounded-md bg-muted/60 px-3.5 py-2 text-sm">
            {mode === "NEW_FORM" ? WELCOME_NEW : WELCOME_ADD}
          </div>
        </div>

        {aiOff ? (
          <div className="rounded-[3px] border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            The AI Form Builder is switched off right now. You can still build forms by hand.
          </div>
        ) : chat.bubbles.length === 0 ? (
          <div className="flex flex-wrap gap-2 pl-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="rounded-[3px] border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {chat.bubbles.map((b) => {
          const approved = chat.approvedDrafts[b.id];
          const pending =
            b.id === chat.draftBubbleId && chat.draft && !chat.isStreaming ? chat.draft : null;
          const card = approved ?? pending;
          return (
            <div key={b.id} className="space-y-2">
              <div className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap break-words rounded-md px-3.5 py-2 text-sm ${
                    b.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : b.error
                        ? "border border-destructive/40 bg-destructive/10 text-foreground"
                        : "bg-muted/60 text-foreground"
                  }`}
                >
                  {b.content || (b.streaming ? <TypingIndicator status={chat.statusNote} /> : null)}
                  {b.streaming && b.content ? (
                    <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-current align-middle opacity-60" />
                  ) : null}
                </div>
              </div>
              {b.streaming && chat.liveFields.length > 0 ? (
                <LiveDraftPreview fields={chat.liveFields} />
              ) : null}
              {card ? (
                <DraftCard
                  draft={card}
                  additionsOnly={additionsOnly}
                  maxFields={100}
                  approved={!!approved}
                  interactive={!approved}
                  busy={busy}
                  approveLabel={approveLabel}
                  onApprove={approve}
                  onSave={saveEdits}
                />
              ) : null}
            </div>
          );
        })}

        {chat.statusNote && chat.bubbles.at(-1)?.content ? (
          <p className="text-center text-xs text-muted-foreground">{chat.statusNote}</p>
        ) : null}
      </div>

      <div className="border-t border-border/60 px-4 py-3">
        <div className="flex items-end gap-2 rounded-md border border-border bg-background/60 p-1.5 pl-3.5 focus-within:border-primary/60">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit(input);
              }
            }}
            rows={1}
            disabled={aiOff}
            aria-label="Describe the form you need"
            placeholder={
              limitReached
                ? "Limit reached"
                : chat.draft
                  ? "Ask for a change…"
                  : "Describe the form you need…"
            }
            className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={voice.toggle}
            disabled={aiOff || chat.isStreaming || !voice.supported}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
            title={
              !voice.supported
                ? "Voice input isn't supported in this browser"
                : voice.listening
                  ? "Stop voice input"
                  : "Start voice input"
            }
            className={`flex size-9 shrink-0 items-center justify-center rounded-[3px] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 ${
              voice.listening ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            {voice.listening ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Mic className="size-4" />
            )}
          </button>
          {chat.isStreaming ? (
            <button
              type="button"
              onClick={chat.cancel}
              className="flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-muted text-foreground transition-transform hover:scale-105"
              aria-label="Stop generating"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit(input)}
              disabled={!input.trim() || aiOff}
              className={`flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${limitReached ? "opacity-50" : ""}`}
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
        {voice.listening ? (
          <p
            className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground"
            aria-live="polite"
          >
            {voice.transcript || "Listening…"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
