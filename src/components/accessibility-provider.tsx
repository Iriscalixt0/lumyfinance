"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ColorTheme = "padrao" | "rosa" | "azul" | "amarelo";
export type FontSize = "normal" | "grande" | "muito-grande";

export type AccessibilitySettings = {
  colorTheme: ColorTheme;
  fontSize: FontSize;
  highContrast: boolean;
  reducedMotion: boolean;
};

const STORAGE_KEY = "lumyf-accessibility";

const defaultSettings: AccessibilitySettings = {
  colorTheme: "padrao",
  fontSize: "normal",
  highContrast: false,
  reducedMotion: false,
};

function readSettings(): AccessibilitySettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as Partial<AccessibilitySettings>;
    return {
      colorTheme: ["padrao", "rosa", "azul", "amarelo"].includes(parsed.colorTheme ?? "")
        ? (parsed.colorTheme as ColorTheme)
        : defaultSettings.colorTheme,
      fontSize: ["normal", "grande", "muito-grande"].includes(parsed.fontSize ?? "")
        ? (parsed.fontSize as FontSize)
        : defaultSettings.fontSize,
      highContrast: Boolean(parsed.highContrast),
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return defaultSettings;
  }
}

function persistSettings(settings: AccessibilitySettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applyAccessibility(settings: AccessibilitySettings) {
  const root = document.documentElement;
  root.setAttribute("data-color-theme", settings.colorTheme);
  root.setAttribute("data-font-size", settings.fontSize);
  root.setAttribute("data-high-contrast", settings.highContrast ? "true" : "false");
  root.setAttribute("data-reduced-motion", settings.reducedMotion ? "true" : "false");
}

const AccessibilityContext = createContext<{
  settings: AccessibilitySettings;
  setColorTheme: (theme: ColorTheme) => void;
  setFontSize: (size: FontSize) => void;
  setHighContrast: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
  resetToDefaults: () => void;
}>({
  settings: defaultSettings,
  setColorTheme: () => {},
  setFontSize: () => {},
  setHighContrast: () => {},
  setReducedMotion: () => {},
  resetToDefaults: () => {},
});

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readSettings();
    setSettings(initial);
    applyAccessibility(initial);
    setMounted(true);
  }, []);

  const update = useCallback((patch: Partial<AccessibilitySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      applyAccessibility(next);
      return next;
    });
  }, []);

  const setColorTheme = useCallback(
    (colorTheme: ColorTheme) => update({ colorTheme }),
    [update]
  );
  const setFontSize = useCallback((fontSize: FontSize) => update({ fontSize }), [update]);
  const setHighContrast = useCallback((highContrast: boolean) => update({ highContrast }), [update]);
  const setReducedMotion = useCallback((reducedMotion: boolean) => update({ reducedMotion }), [update]);
  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    persistSettings(defaultSettings);
    applyAccessibility(defaultSettings);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        setColorTheme,
        setFontSize,
        setHighContrast,
        setReducedMotion,
        resetToDefaults,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
