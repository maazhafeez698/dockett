"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechEventLike {
  results: ArrayLike<SpeechResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onTranscript?: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      }
    };
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      toast.error("Couldn't stop voice input. Please try again.");
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) {
      toast.info("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
      setSupported(false);
      return;
    }

    const recognition = new Ctor();
    let finalTranscript = "";
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    setTranscript("");

    recognition.onresult = (event) => {
      const finalized: string[] = [];
      const interim: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0].transcript.trim();
        if (result.isFinal) finalized.push(text);
        else interim.push(text);
      }
      finalTranscript = finalized.join(" ");
      setTranscript([...finalized, ...interim].filter(Boolean).join(" "));
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Microphone access was blocked. Allow it in your browser to use voice.");
      } else if (event.error && event.error !== "aborted" && event.error !== "no-speech") {
        toast.error("Couldn't hear that. Please try again.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalTranscript.trim();
      if (text) onTranscriptRef.current?.(text);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      toast.error("Couldn't start voice input. Please try again.");
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, transcript, start, stop, toggle };
}
