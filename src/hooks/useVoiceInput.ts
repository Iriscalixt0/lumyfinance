import { useState, useCallback, useRef, useEffect } from "react";

interface UseVoiceInputOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for browser-native speech recognition (Web Speech API).
 * Uses refs for stable callbacks to avoid stale closure issues.
 * Handles auto-restart on silence timeout and permission errors.
 */
export function useVoiceInput({ lang = "pt-BR", onResult, onError }: UseVoiceInputOptions = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Keep callbacks in refs to avoid stale closures
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

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

    // Stop any existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const results = event.results;
      if (results && results.length > 0 && results[0].length > 0) {
        const transcript = results[0][0].transcript;
        isListeningRef.current = false;
        setListening(false);
        onResultRef.current?.(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      const error = event.error;
      console.warn("[VoiceInput] SpeechRecognition error:", error);

      if (error === "no-speech") {
        // Silence timeout — auto-restart if still listening
        if (isListeningRef.current) {
          try { recognition.start(); } catch {}
          return;
        }
      }

      if (error === "not-allowed" || error === "service-not-allowed") {
        onErrorRef.current?.("not-allowed");
      } else if (error === "aborted") {
        // User cancelled — no error needed
      } else {
        onErrorRef.current?.(error);
      }

      isListeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      // Auto-restart on silence if still intending to listen
      if (isListeningRef.current) {
        try { recognition.start(); } catch {
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
