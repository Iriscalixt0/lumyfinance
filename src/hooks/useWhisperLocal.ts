import { useState, useCallback, useRef, useEffect } from "react";

type WhisperStatus = "idle" | "loading-model" | "recording" | "transcribing";

interface UseWhisperLocalOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: WhisperStatus, progress?: number) => void;
}

let pipelinePromise: Promise<any> | null = null;
let cachedPipeline: any = null;

async function getWhisperPipeline(onProgress?: (p: number) => void) {
  if (cachedPipeline) return cachedPipeline;
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const pipe = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p: any) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          onProgress?.(Math.round(p.progress));
        }
      },
    });
    cachedPipeline = pipe;
    return pipe;
  })();

  return pipelinePromise;
}

/**
 * Hook for local Whisper WASM speech recognition.
 * Downloads ~75MB model on first use, then cached by browser.
 */
export function useWhisperLocal({
  lang = "pt",
  onResult,
  onError,
  onStatusChange,
}: UseWhisperLocalOptions = {}) {
  const [status, setStatus] = useState<WhisperStatus>("idle");
  const [modelProgress, setModelProgress] = useState(0);
  const [supported, setSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const updateStatus = useCallback((s: WhisperStatus, progress?: number) => {
    setStatus(s);
    onStatusChangeRef.current?.(s, progress);
  }, []);

  // Extract 2-letter lang code
  const whisperLang = lang.split("-")[0].toLowerCase();

  const start = useCallback(async () => {
    try {
      // 1. Load model (cached after first time)
      updateStatus("loading-model", 0);
      await getWhisperPipeline((p) => {
        setModelProgress(p);
        updateStatus("loading-model", p);
      });

      // 2. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      updateStatus("recording");
    } catch (err: any) {
      console.error("[WhisperLocal] Error:", err);
      if (err.name === "NotAllowedError") {
        onErrorRef.current?.("not-allowed");
      } else if (err.name === "NotFoundError") {
        onErrorRef.current?.("audio-capture");
      } else {
        onErrorRef.current?.(err.message || "whisper-error");
      }
      updateStatus("idle");
    }
  }, [whisperLang, updateStatus]);

  const stop = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      updateStatus("idle");
      return;
    }

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        // Stop microphone
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          onErrorRef.current?.("no-speech");
          updateStatus("idle");
          resolve();
          return;
        }

        try {
          updateStatus("transcribing");

          // Convert blob to Float32Array PCM
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const pcm = audioBuffer.getChannelData(0); // mono Float32Array

          const pipe = await getWhisperPipeline();
          const result = await pipe(pcm, {
            language: whisperLang,
            task: "transcribe",
          });

          const text = (result as any)?.text?.trim();
          if (text) {
            onResultRef.current?.(text);
          } else {
            onErrorRef.current?.("no-speech");
          }
        } catch (err: any) {
          console.error("[WhisperLocal] Transcription error:", err);
          onErrorRef.current?.(err.message || "transcription-error");
        }

        updateStatus("idle");
        resolve();
      };

      mediaRecorder.stop();
    });
  }, [whisperLang, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { status, modelProgress, supported, start, stop };
}
