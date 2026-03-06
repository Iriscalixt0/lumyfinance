import { useState, useCallback, useRef, useEffect } from "react";

interface UseVoiceInputOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
}

function postProcess(text: string, lang: string): string {
  let r = text.trim();
  const l = lang.toLowerCase();
  if (l.startsWith("pt")) {
    r = r
      .replace(/\b(\d+)\s*(rais|reis|real)\b/gi, "$1 reais")
      .replace(/\bpix\b/gi, "Pix")
      .replace(/\bcartao\b/gi, "cartão")
      .replace(/\bdebito\b/gi, "débito")
      .replace(/\bcredito\b/gi, "crédito")
      .replace(/\btransferencia\b/gi, "transferência")
      .replace(/\bfarmacia\b/gi, "farmácia");
  } else if (l.startsWith("es")) {
    r = r.replace(/\b(\d+)\s*peso\b/gi, "$1 pesos");
  } else if (l.startsWith("fr")) {
    r = r.replace(/\b(\d+)\s*euro\b/gi, "$1 euros");
  } else if (l.startsWith("en")) {
    r = r
      .replace(/\b(\d+)\s*dollar\b/gi, "$1 dollars")
      .replace(/\b(\d+)\s*buck\b/gi, "$1 dollars");
  }
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function useVoiceInput({
  lang = "pt-BR",
  onResult,
  onInterim,
  onError,
}: UseVoiceInputOptions = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const finalCalledRef = useRef(false);

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
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onErrorRef.current?.("not_supported"); return; }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;      // FIX: no loop
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;     // FIX: pick best alternative

    finalCalledRef.current = false;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        let bestText = res[0].transcript;
        let bestConf = res[0].confidence ?? 0;
        for (let j = 1; j < res.length; j++) {
          const c = res[j].confidence ?? 0;
          if (c > bestConf) { bestText = res[j].transcript; bestConf = c; }
        }
        if (res.isFinal) finalTranscript += bestText;
        else interimTranscript += bestText;
      }

      if (interimTranscript) onInterimRef.current?.(interimTranscript.trim());

      if (finalTranscript.trim() && !finalCalledRef.current) {
        finalCalledRef.current = true;
        isListeningRef.current = false;
        setListening(false);
        onResultRef.current?.(postProcess(finalTranscript, lang)); // FIX: post-process
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === "no-speech" || err === "aborted") return;
      if (err === "not-allowed" || err === "service-not-allowed") onErrorRef.current?.("not-allowed");
      else if (err === "audio-capture") onErrorRef.current?.("audio-capture");
      else if (err === "network") onErrorRef.current?.("network");
      else onErrorRef.current?.(err);
      isListeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      // FIX: do NOT restart — no infinite loop
      isListeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    finalCalledRef.current = false;
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
