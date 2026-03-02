"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallPromptContextValue = {
  installPrompt: BeforeInstallPromptEvent | null;
  /** Dispara o diálogo nativo de instalação. Retorna true se o diálogo foi mostrado, false caso contrário (mostrar instruções manuais). */
  triggerInstall: () => Promise<boolean>;
};

const InstallPromptContext = createContext<InstallPromptContextValue | null>(null);

export function InstallPromptProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstallPrompt(null);
      return true;
    } catch {
      return false;
    }
  }, [installPrompt]);

  return (
    <InstallPromptContext.Provider value={{ installPrompt, triggerInstall }}>
      {children}
    </InstallPromptContext.Provider>
  );
}

export function useInstallPrompt(): InstallPromptContextValue {
  const ctx = useContext(InstallPromptContext);
  if (!ctx) {
    return {
      installPrompt: null,
      triggerInstall: async () => false,
    };
  }
  return ctx;
}
