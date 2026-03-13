import { useState, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import { useHybridVoice } from "@/hooks/useHybridVoice";
import { useLocale, useTranslations } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";

const LOCALE_TO_VOICE: Record<string, string> = {
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

interface VoiceInputButtonProps {
  /** Called with the final transcript */
  onTranscript: (transcript: string) => void;
  /** Optional hint shown in tooltip */
  hint?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
  disabled?: boolean;
}

/**
 * Reusable microphone button that transcribes voice and returns the raw text.
 * Pages are responsible for parsing the transcript into form fields.
 */
export function VoiceInputButton({
  onTranscript,
  hint,
  className = "",
  size = "sm",
  disabled = false,
}: VoiceInputButtonProps) {
  const locale = useLocale();
  const t = useTranslations("voiceInput");
  const { toast } = useToast();
  const [interimText, setInterimText] = useState("");
  const voiceLang = LOCALE_TO_VOICE[locale] || "en-US";

  const handleResult = useCallback(
    (transcript: string) => {
      setInterimText("");
      onTranscript(transcript);
    },
    [onTranscript]
  );

  const handleInterim = useCallback((text: string) => {
    setInterimText(text);
  }, []);

  const handleError = useCallback(
    (err: string) => {
      setInterimText("");
      if (err === "no-speech") toast(t("noSpeech"), "error");
      else if (err === "not_supported") toast(t("notSupported"), "error");
      else if (err === "not-allowed" || err === "audio-capture") toast(t("micDenied"), "error");
      else toast(t("error"), "error");
    },
    [t, toast]
  );

  const { listening, supported, start, stop } = useHybridVoice({
    lang: voiceLang,
    onResult: handleResult,
    onInterim: handleInterim,
    onError: handleError,
  });

  if (!supported) return null;

  const sizeClasses = size === "sm"
    ? "h-9 w-9 rounded-lg"
    : "h-11 w-11 rounded-xl";

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        disabled={disabled}
        title={hint || t("hint")}
        className={`relative flex items-center justify-center transition-all ${sizeClasses} ${
          listening
            ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 animate-pulse"
            : "bg-primary/10 text-primary hover:bg-primary/20"
        } ${disabled ? "opacity-40 pointer-events-none" : ""} ${className}`}
      >
        {listening ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <Mic className={iconSize} />
        )}
        {listening && (
          <span
            className="absolute inset-0 rounded-[inherit] border-2 border-destructive/50 pointer-events-none"
            style={{ animation: "voice-ripple 1.5s ease-out infinite" }}
          />
        )}
      </button>
      {interimText && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-lg z-50 min-w-[200px] max-w-[300px]">
          <p className="text-xs text-muted-foreground italic truncate">{interimText}</p>
        </div>
      )}
    </div>
  );
}
