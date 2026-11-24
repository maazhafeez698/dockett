//
// Conversation state for the AI Form Builder. Owns: the message list, the
// live (still-streaming) field preview, the pending draft awaiting
// Approve/Modify, credits, and the request lifecycle (single-flight, cancel,
// unmount cleanup).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  newRequestId,
  streamAiForm,
  type AiChatTurn,
  type AiCredits,
  type AiDraft,
  type AiDraftField,
  type AiStreamError,
} from "~/lib/ai-stream";

export interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  /** This assistant turn produced the draft card (only the latest one is interactive). */
  hasDraft?: boolean;
}

interface UseAiChatOptions {
  mode: "NEW_FORM" | "ADD_FIELDS";
  formId?: string;
  onCredits?(credits: AiCredits): void;
}

const MAX_HISTORY_TURNS = 10;
const MAX_TURN_CHARS = 2000;

export function useAiChat({ mode, formId, onCredits }: UseAiChatOptions) {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  /** Fields received so far for the in-flight request. */
  const [liveFields, setLiveFields] = useState<AiDraftField[]>([]);
  /** The proposal waiting for Approve / Modify. */
  const [draft, setDraftState] = useState<AiDraft | null>(null);
  const [draftBubbleId, setDraftBubbleId] = useState<string | null>(null);
  /** Snapshots of drafts the user approved, keyed by the assistant bubble that proposed them. */
  const [approvedDrafts, setApprovedDrafts] = useState<Record<string, AiDraft>>({});
  const [lastError, setLastError] = useState<AiStreamError | null>(null);

  const inFlight = useRef(false); // synchronous guard: state updates are too slow to stop a double-click
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<AiChatTurn[]>([]);
  const draftRef = useRef<AiDraft | null>(null);
  const onCreditsRef = useRef(onCredits);
  onCreditsRef.current = onCredits;

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchLast = (fn: (b: ChatBubble) => ChatBubble) =>
    setBubbles((prev) => (prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1]!)] : prev));

  const setDraft = useCallback((d: AiDraft | null) => {
    draftRef.current = d;
    setDraftState(d);
  }, []);

  const send = useCallback(
    async (rawPrompt: string): Promise<boolean> => {
      const prompt = rawPrompt.trim();
      if (!prompt || inFlight.current) return false;
      inFlight.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = newRequestId();
      const assistantId = `${requestId}-a`;

      setBubbles((prev) => [
        ...prev,
        { id: `${requestId}-u`, role: "user", content: prompt },
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      setIsStreaming(true);
      setStatusNote(null);
      setLastError(null);
      setLiveFields([]);

      const history = historyRef.current.slice(-MAX_HISTORY_TURNS).map((t) => ({
        role: t.role,
        content: t.content.slice(0, MAX_TURN_CHARS),
      }));

      let succeeded = false;
      let streamedReply = "";

      await streamAiForm(
        {
          requestId,
          mode,
          formId: mode === "ADD_FIELDS" ? formId : undefined,
          prompt,
          history,
          // Whatever is pending (including the user's own edits) is what the AI builds on.
          currentDraft: draftRef.current ?? undefined,
        },
        {
          onStatus: (s) => setStatusNote(s.message),
          onReply: (delta) => {
            setStatusNote(null);
            streamedReply += delta;
            patchLast((b) => ({ ...b, content: b.content + delta }));
          },
          onField: (index, field) =>
            setLiveFields((prev) => {
              const next = prev.slice(0, index);
              next[index] = field;
              return next;
            }),
          onReset: () => {
            streamedReply = "";
            setLiveFields([]);
            patchLast((b) => ({ ...b, content: "" }));
          },
          onDone: (d) => {
            succeeded = true;
            setStatusNote(null);
            patchLast((b) => ({ ...b, content: d.reply, streaming: false, hasDraft: !!d.draft }));
            historyRef.current = [
              ...historyRef.current,
              { role: "user", content: prompt },
              { role: "assistant", content: d.reply },
            ];
            if (d.draft) {
              setDraft(d.draft);
              setDraftBubbleId(assistantId);
            }
            setLiveFields([]);
            onCreditsRef.current?.(d.credits);
          },
          onError: (e) => {
            setLastError(e);
            setStatusNote(null);
            setLiveFields([]);
            patchLast((b) => ({ ...b, content: e.message, streaming: false, error: true }));
          },
        },
        controller.signal,
      );

      // Cancelled by the user: keep whatever streamed, mark it finished.
      if (controller.signal.aborted && !succeeded) {
        patchLast((b) => {
          const text = (streamedReply || b.content).trim();
          return { ...b, streaming: false, content: text ? `${text} …(stopped)` : "Stopped." };
        });
        setLiveFields([]);
        setStatusNote(null);
      }

      abortRef.current = null;
      inFlight.current = false;
      setIsStreaming(false);
      return succeeded;
    },
    [mode, formId, setDraft],
  );

  /** A local assistant-side notice that never touches the network (e.g. "Limit reached"). */
  const notify = useCallback((content: string) => {
    setBubbles((prev) => [
      ...prev,
      { id: `notice-${Date.now()}`, role: "assistant", content, error: true },
    ]);
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    historyRef.current = [];
    setBubbles([]);
    setDraft(null);
    setDraftBubbleId(null);
    setApprovedDrafts({});
    setLiveFields([]);
    setLastError(null);
    setStatusNote(null);
  }, [setDraft]);

  /** The draft was approved and applied: lock its card and stop sending it as pending context. */
  const markApproved = useCallback(() => {
    const approved = draftRef.current;
    if (draftBubbleId && approved)
      setApprovedDrafts((prev) => ({ ...prev, [draftBubbleId]: approved }));
    setDraft(null);
  }, [draftBubbleId, setDraft]);

  return {
    bubbles,
    isStreaming,
    statusNote,
    liveFields,
    draft,
    draftBubbleId,
    approvedDrafts,
    lastError,
    send,
    cancel,
    reset,
    notify,
    setDraft,
    markApproved,
  };
}
