"use client";

import { Moon, Palette, Type, Eye, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/theme-provider";
import { useAccessibility, type FontSize } from "@/components/accessibility-provider";
import { Link } from "@/i18n/navigation";

const FONT_SIZE_KEYS: { value: FontSize; labelKey: string; helperKey: string }[] = [
  { value: "normal", labelKey: "fontNormal", helperKey: "fontNormalHelper" },
  { value: "grande", labelKey: "fontLarge", helperKey: "fontLargeHelper" },
  { value: "muito-grande", labelKey: "fontXLarge", helperKey: "fontXLargeHelper" },
];

export function AccessibilityPageContent() {
  const t = useTranslations("accessibility");
  const { theme, toggleTheme } = useTheme();
  const {
    settings: a11y,
    setFontSize,
    setHighContrast,
    setReducedMotion,
  } = useAccessibility();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-bold text-foreground">{t("sectionTitle")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-secondary/30"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              {t("theme")}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("themeCurrentLabel")}: {theme === "dark" ? t("themeDark") : t("themeLight")}
            </p>
          </button>

          <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Eye size={16} />
              {t("highContrast")}
            </span>
            <input
              type="checkbox"
              checked={a11y.highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette size={16} />
              {t("reducedMotion")}
            </span>
            <input
              type="checkbox"
              checked={a11y.reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
          </label>

          <div className="rounded-xl border border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Type size={16} />
              {t("font")}
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {FONT_SIZE_KEYS.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setFontSize(size.value)}
                  className={`rounded-lg border px-3 py-1 text-xs ${
                    a11y.fontSize === size.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  aria-pressed={a11y.fontSize === size.value}
                >
                  <span className="font-semibold">{t(size.labelKey)}</span>{" "}
                  <span className="opacity-75">- {t(size.helperKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link href="/" className="text-primary hover:underline">
          {t("backLink")}
        </Link>
      </p>
    </div>
  );
}
