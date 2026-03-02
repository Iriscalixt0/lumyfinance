"use client";

import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useTranslations } from "next-intl";

export function BlogNav() {
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("landing");
  const tBlog = useTranslations("blog");

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-5 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          <Logo size="sm" />
          <span className="text-gradient-hero">Lumyf</span>
        </Link>

        {/* Back to site */}
        <Link
          href="/"
          className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {tBlog("nav.backToSite")}
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label={theme === "dark" ? t("theme.activateLight") : t("theme.activateDark")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <Link
            href="/register"
            className="bg-hero-gradient text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("nav.createAccount")}
          </Link>
        </div>
      </div>
    </header>
  );
}
