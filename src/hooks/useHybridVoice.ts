import { useState, useCallback, useRef } from "react";
import { useVoiceInput } from "./useVoiceInput";

export type VoiceEngine = "web-speech" | "whisper-local" | "idle";

interface UseHybridVoiceOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useHybridVoice({
  lang = "pt-BR",
  onResult,
  onInterim,
  onError,
}: UseHybridVoiceOptions = {}) {
  const [activeEngine, setActiveEngine] = useState<VoiceEngine>("idle");
  const webSpeechFailedRef = useRef(false); // FIX: ref persists across renders

  // FIX: declare handleWebSpeechError BEFORE passing to hook
  const handleWebSpeechError = useCallback((err: string) => {
    if (err === "not_supported" || err === "network" || err === "start-failed") {
      webSpeechFailedRef.current = true;
      setActiveEngine("idle");
      onError?.("not_supported");
      return;
    }
    // Permission errors don't fallback — need user action
    onError?.(err);
    setActiveEngine("idle");
  }, [onError]);

  const handleResult = useCallback((transcript: string) => {
    setActiveEngine("idle");
    onResult?.(transcript);
  }, [onResult]);

  const webSpeech = useVoiceInput({
    lang,
    onResult: handleResult,
    onInterim,
    onError: handleWebSpeechError, // FIX: declared before usage
  });

  const start = useCallback(async () => {
    if (webSpeechFailedRef.current || !webSpeech.supported) {
      onError?.("not_supported");
      return;
    }
    setActiveEngine("web-speech");
    webSpeech.start();
  }, [webSpeech, onError]);

  const stop = useCallback(() => {
    webSpeech.stop();
    setActiveEngine("idle");
  }, [webSpeech]);

  const supported = webSpeech.supported;
  const listening = activeEngine !== "idle";

  return {
    listening,
    supported,
    activeEngine,
    start,
    stop,
  };
}

// Re-export speak for convenience
export { speak } from "./useVoiceInput";
