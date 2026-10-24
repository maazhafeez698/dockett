"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Check, Loader2, RotateCcw, Sparkles, Square } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useAiChat } from "~/hooks/use-ai-chat";
import { useAiUsage, useApplyAiDraft, useSaveAiDraft } from "~/hooks/api/ai";
import type { AiCredits, AiDraftField } from "~/lib/ai-stream";
import { TypingIndicator } from "./ai-form-builder/typing-indicator";

const TYPE_LABEL: Record<string, string> = {
  TEXT: "Short text",
  LONG_TEXT: "Long text",
  EMAIL: "Email",
  NUMBER: "Number",
  YES_NO: "Yes / No",
  DROPDOWN: "Single-select",
  RADIO_GROUP: "Radio group",
  MULTI_SELECT: "Multi-select",
  CHECKBOX_GROUP: "Checkboxes",
  DATE: "Date",
  RATING: "Rating",
};

const SUGGESTIONS: Record<"NEW_FORM" | "ADD_FIELDS", string[]> = {
  NEW_FORM: [
    "Customer feedback survey",
    "Event RSVP with meal choices",
    "Job application",
    "Workshop sign-up",
  ],
  ADD_FIELDS: [
    "Add a phone number and preferred contact time",
    "Add a rating and open comments",
    "Add consent checkbox",
  ],
};

interface AiChatDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  mode: "NEW_FORM" | "ADD_FIELDS";
  formId?: string;
  /** Sent automatically the first time the dialog opens (used by the dashboard prompt bar). */
  initialPrompt?: string;
  onInitialPromptConsumed?(): void;
}

function formatReset(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "soon";
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function FieldRow({ field, dim }: { field: AiDraftField; dim?: boolean }) {
  return (
    <li
      className={`flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm ${dim ? "opacity-70" : ""}`}
    >
      <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {TYPE_LABEL[field.type] ?? field.type}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {field.label}
          {field.isRequired ? <span className="text-destructive"> *</span> : null}
        </span>
        {field.config?.options?.length ? (
          <span className="block truncate text-xs text-muted-foreground">
            {field.config.options.join(" · ")}
          </span>
        ) : null}
      </span>
    </li>
  );
}

export function AiChatDialog({
  open,
  onOpenChange,
  mode,
  formId,
  initialPrompt,
  onInitialPromptConsumed,
}: AiChatDialogProps) {
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

  // Live credits beat the last fetched usage; the server is always the source of truth.
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

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.bubbles, chat.liveFields.length]);

  // Re-arm once the parent has consumed the prompt, so the next dashboard prompt auto-sends too.
  useEffect(() => {
    if (!initialPrompt) initialSent.current = false;
  }, [initialPrompt]);

  // Dashboard flow: fire the prompt the user already typed, exactly once.
  useEffect(() => {
    if (open && initialPrompt && !initialSent.current && !aiOff && !limitReached) {
      initialSent.current = true;
      onInitialPromptConsumed?.();
      void chat.send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, aiOff, limitReached]);

  const submit = async (text: string) => {
    if (!text.trim() || chat.isStreaming || limitReached || aiOff) return;
    setInput("");
    const ok = await chat.send(text);
    if (!ok) setInput((cur) => cur || text); // let the user retry without retyping
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && chat.isStreaming) chat.cancel();
    onOpenChange(next);
  };

  const approve = async () => {
    if (!chat.draft) return;
    try {
      if (mode === "NEW_FORM") {
        const { id } = await saveDraftAsync({ draft: chat.draft });
        toast.success("Form created — have a look!");
        chat.reset();
        onOpenChange(false);
        router.push(`/dashboard/forms/${id}`);
      } else if (formId) {
        const { added } = await applyDraftAsync({ formId, draft: chat.draft });
        toast.success(`Added ${added} field${added === 1 ? "" : "s"} to your form`);
        chat.markApproved();
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that. Please try again.");
    }
  };

  const previewFields = chat.isStreaming ? chat.liveFields : (chat.draft?.fields ?? []);
  const showPreview = previewFields.length > 0;
  const resetText = credits?.limitReached ? formatReset(credits.resetsAt, now) : null;
  const busy = saving || applying;

  const usageLabel = !credits
    ? null
    : limitReached
      ? `Credits exhausted${resetText ? ` · resets in ${resetText}` : ""}`
      : `${credits.percentUsed}% credits consumed${resetText && credits.percentUsed > 0 ? ` · resets in ${resetText}` : ""}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            {mode === "NEW_FORM" ? "Build a form with AI" : "Add fields with AI"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "NEW_FORM"
              ? "Describe what you need. You'll review the draft before anything is created."
              : "Describe what to add. You'll review the new fields before they join your form."}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-5 py-4"
          aria-live="polite"
        >
          {aiOff ? (
            <div className="rounded-[3px] border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              AI form building is switched off right now. You can still build forms by hand.
            </div>
          ) : chat.bubbles.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {mode === "NEW_FORM"
                  ? "What kind of form are we making today?"
                  : "What should we add to this form?"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS[mode].map((s) => (
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
            </div>
          ) : (
            chat.bubbles.map((b) => (
              <div
                key={b.id}
                className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3.5 py-2 text-sm ${
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
            ))
          )}

          {chat.statusNote && chat.bubbles.at(-1)?.content ? (
            <p className="text-center text-xs text-muted-foreground">{chat.statusNote}</p>
          ) : null}

          {showPreview ? (
            <div className="rounded-[3px] border border-border/70 bg-card/40 p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  {mode === "NEW_FORM" ? (chat.draft?.title ?? "Drafting…") : "New fields"}
                </p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {previewFields.length} field{previewFields.length === 1 ? "" : "s"}
                  {chat.isStreaming ? " so far…" : ""}
                </p>
              </div>
              {mode === "NEW_FORM" && chat.draft?.description && !chat.isStreaming ? (
                <p className="mb-2 text-xs text-muted-foreground">{chat.draft.description}</p>
              ) : null}
              <ul className="space-y-1.5">
                {previewFields.map((f, i) => (
                  <FieldRow key={`${i}-${f.label}`} field={f} dim={chat.isStreaming} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border/60 px-5 py-3">
          {chat.draft && !chat.isStreaming ? (
            <div className="flex items-center justify-between gap-2 rounded-[3px] bg-primary/10 px-3 py-2">
              <p className="text-xs text-foreground">
                {mode === "NEW_FORM"
                  ? "Happy with it? Ask for changes, or create it."
                  : "Happy with these? Ask for changes, or add them."}
              </p>
              <Button size="sm" onClick={approve} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 size-3.5" />
                )}
                {mode === "NEW_FORM"
                  ? "Create form"
                  : `Add ${chat.draft.fields.length} field${chat.draft.fields.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          ) : null}

          <div className="glass flex items-end gap-2 rounded-md p-2 pl-4">
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
              disabled={aiOff || limitReached}
              placeholder={
                limitReached
                  ? "Your AI credits are exhausted for this session"
                  : chat.draft
                    ? "Ask for a change…"
                    : mode === "NEW_FORM"
                      ? 'Try "Create a customer satisfaction survey"'
                      : 'Try "Add a phone number field"'
              }
              className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            {chat.isStreaming ? (
              <button
                type="button"
                onClick={chat.cancel}
                className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-muted text-foreground transition-transform hover:scale-105"
                aria-label="Stop generating"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit(input)}
                disabled={!input.trim() || aiOff || limitReached}
                className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{usageLabel ?? "\u00A0"}</span>
            {chat.bubbles.length > 0 && !chat.isStreaming ? (
              <button
                type="button"
                onClick={chat.reset}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <RotateCcw className="size-3" /> Start over
              </button>
            ) : (
              <span>Enter to send · Shift+Enter for a new line</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
