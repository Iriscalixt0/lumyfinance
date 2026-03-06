import { useState, useCallback, useRef, useEffect } from "react";
import { useVoiceInput, speak } from "./useVoiceInput";
import { useWhisperLocal } from "./useWhisperLocal";

export type VoiceEngine = "web-speech" | "whisper-local";
export type HybridVoiceStatus = "idle" | "loading-model" | "listening" | "transcribing";

interface UseHybridVoiceOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
  onEngineChange?: (engine: VoiceEngine) => void;
  onModelProgress?: (progress: number) => void;
}

/**
 * Hybrid voice hook: tries Web Speech API first, falls back to Whisper WASM.
 */
export function useHybridVoice({
  lang = "pt-BR",
  onResult,
  onInterim,
  onError,
  onEngineChange,
  onModelProgress,
}: UseHybridVoiceOptions = {}) {
  const [activeEngine, setActiveEngine] = useState<VoiceEngine | null>(null);
  const [status, setStatus] = useState<HybridVoiceStatus>("idle");
  const [modelProgress, setModelProgress] = useState(0);

  const webSpeechFailedRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  const onEngineChangeRef = useRef(onEngineChange);
  const onModelProgressRef = useRef(onModelProgress);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onEngineChangeRef.current = onEngineChange; }, [onEngineChange]);
  useEffect(() => { onModelProgressRef.current = onModelProgress; }, [onModelProgress]);

  // Web Speech API handlers
  const handleWebSpeechResult = useCallback((transcript: string) => {
    setStatus("idle");
    onResultRef.current?.(transcript);
  }, []);

  const handleWebSpeechInterim = useCallback((transcript: string) => {
    onInterimRef.current?.(transcript);
  }, []);

  const handleWebSpeechError = useCallback((err: string) => {
    // If Web Speech fails, try Whisper local as fallback
    if (err === "not_supported" || err === "network" || err === "start-failed" || err === "service-not-allowed") {
      console.log("[HybridVoice] Web Speech failed, falling back to Whisper local:", err);
      webSpeechFailedRef.current = true;
      startWhisper();
      return;
    }
    // For permission errors, don't fallback (Whisper will have same issue)
    setStatus("idle");
    onErrorRef.current?.(err);
  }, []);

  const webSpeech = useVoiceInput({
    lang,
    onResult: handleWebSpeechResult,
    onInterim: handleWebSpeechInterim,
    onError: handleWebSpeechError,
  });

  // Whisper local handlers
  const handleWhisperResult = useCallback((transcript: string) => {
    setStatus("idle");
    onResultRef.current?.(transcript);
  }, []);

  const handleWhisperError = useCallback((err: string) => {
    setStatus("idle");
    onErrorRef.current?.(err);
  }, []);

  const handleWhisperStatus = useCallback((s: string, progress?: number) => {
    if (s === "loading-model") {
      setStatus("loading-model");
      if (typeof progress === "number") {
        setModelProgress(progress);
        onModelProgressRef.current?.(progress);
      }
    } else if (s === "recording") {
      setStatus("listening");
    } else if (s === "transcribing") {
      setStatus("transcribing");
    } else {
      setStatus("idle");
    }
  }, []);

  const whisperLocal = useWhisperLocal({
    lang: lang.split("-")[0],
    onResult: handleWhisperResult,
    onError: handleWhisperError,
    onStatusChange: handleWhisperStatus,
  });

  const startWhisper = useCallback(async () => {
    setActiveEngine("whisper-local");
    onEngineChangeRef.current?.("whisper-local");
    await whisperLocal.start();
  }, [whisperLocal]);

  const start = useCallback(async () => {
    // If Web Speech previously failed, go directly to Whisper
    if (webSpeechFailedRef.current || !webSpeech.supported) {
      await startWhisper();
      return;
    }

    // Try Web Speech first
    setActiveEngine("web-speech");
    onEngineChangeRef.current?.("web-speech");
    setStatus("listening");
    webSpeech.start();
  }, [webSpeech, startWhisper]);

  const stop = useCallback(async () => {
    if (activeEngine === "whisper-local") {
      await whisperLocal.stop();
    } else {
      webSpeech.stop();
    }
    setStatus("idle");
  }, [activeEngine, webSpeech, whisperLocal]);

  return {
    status,
    activeEngine,
    modelProgress,
    start,
    stop,
    supported: webSpeech.supported || whisperLocal.supported,
  };
}

// Re-export speak for convenience
export { speak } from "./useVoiceInput";
