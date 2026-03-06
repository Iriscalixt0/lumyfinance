import { useState, useCallback, useRef, useEffect } from "react";

interface UseVoiceInputOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for browser-native speech recognition (Web Speech API).
 * Supports auto-detect language mode and TTS feedback.
 */
export function useVoiceInput({ lang = "pt-BR", onResult, onInterim, onError }: UseVoiceInputOptions = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
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
    if (!SR) { onErrorRef.current?.("not_supported"); return; }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) { finalTranscript += text; }
        else { interimTranscript += text; }
      }

      if (interimTranscript) onInterimRef.current?.(interimTranscript.trim());

      if (finalTranscript.trim()) {
        isListeningRef.current = false;
        setListening(false);
        try { recognition.stop(); } catch {}
        onResultRef.current?.(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      const error = event.error;
      if (error === "no-speech") return;
      if (error === "not-allowed" || error === "service-not-allowed") onErrorRef.current?.("not-allowed");
      else if (error === "audio-capture") onErrorRef.current?.("audio-capture");
      else if (error === "aborted") { /* noop */ }
      else if (error === "network") onErrorRef.current?.("network");
      else onErrorRef.current?.(error);
      isListeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start(); } catch { isListeningRef.current = false; setListening(false); }
        return;
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setListening(true);

    try { recognition.start(); }
    catch {
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

// ===================== TTS =====================

export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
