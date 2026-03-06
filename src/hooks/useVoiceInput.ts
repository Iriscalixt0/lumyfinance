import { useState, useCallback, useRef, useEffect } from "react";

interface UseVoiceInputOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for browser-native speech recognition (Web Speech API).
 * - Uses refs for stable callbacks (no stale closures)
 * - Waits for isFinal results for better accuracy
 * - Auto-restarts on silence timeout
 * - Handles permission and browser errors
 */
export function useVoiceInput({ lang = "pt-BR", onResult, onInterim, onError }: UseVoiceInputOptions = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Stable callback refs
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Check support on mount
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onErrorRef.current?.("not_supported");
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = true;        // Keep listening until stopped
    recognition.interimResults = true;    // Get partial results for feedback
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      // Show interim feedback (partial text while user speaks)
      if (interimTranscript && !finalTranscript) {
        onInterimRef.current?.(interimTranscript);
      }

      // Only process final (accurate) transcripts
      if (finalTranscript) {
        isListeningRef.current = false;
        setListening(false);
        try { recognition.stop(); } catch {}
        onResultRef.current?.(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      const error = event.error;
      console.warn("[VoiceInput] error:", error);

      if (error === "no-speech") {
        // Silence timeout — auto-restart handled by onend
        return;
      }

      if (error === "not-allowed" || error === "service-not-allowed") {
        onErrorRef.current?.("not-allowed");
      } else if (error === "aborted") {
        // User or system cancelled — no error needed
      } else if (error === "network") {
        onErrorRef.current?.("network");
      } else {
        onErrorRef.current?.(error);
      }

      isListeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if still intending to listen (e.g. silence timeout)
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          isListeningRef.current = false;
          setListening(false);
        }
        return;
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setListening(true);

    try {
      recognition.start();
    } catch (e: any) {
      console.error("[VoiceInput] Failed to start:", e);
      isListeningRef.current = false;
      setListening(false);
      onErrorRef.current?.("start-failed");
    }
  }, [lang]);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
