"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PRODUCT_CONFIG } from "@/lib/product-config";
import { useState, useEffect } from "react";
import { Logo } from "@/components/logo";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  PiggyBank,
  Shield,
  Target,
  Users,
  Wallet,
  TrendingUp,
  Menu,
  X,
  ChevronDown,
  HelpCircle,
  Moon,
  Sun,
  Download,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PlanCard } from "@/components/plan/plan-card";
import { useInstallPrompt } from "@/components/install-prompt-provider";

export function LandingPage({ betaToken }: { betaToken?: string }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { theme, toggleTheme } = useTheme();
  const { triggerInstall } = useInstallPrompt();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function handleDownloadApp() {
    setMobileOpen(false);
    await triggerInstall();
  }
  const betaRedirect = betaToken ? `/${locale}/beta/${betaToken}` : null;
  const loginHref = betaRedirect ? `/login?redirect=${encodeURIComponent(betaRedirect)}` : "/login";
  const registerHref = betaRedirect ? `/register?redirect=${encodeURIComponent(betaRedirect)}` : "/register";

  const NAV_LINKS = [
    { label: t("nav.features"), href: "funcionalidades" },
    { label: t("nav.pricing"), href: "precos" },
    { label: t("nav.faq"), href: "faq" },
    { label: t("nav.about"), href: "sobre" },
  ];

  const FEATURES = [
    { icon: Wallet, title: t("features.incomeExpenses.title"), desc: t("features.incomeExpenses.desc") },
    { icon: Target, title: t("features.goals.title"), desc: t("features.goals.desc") },
    { icon: TrendingUp, title: t("features.investments.title"), desc: t("features.investments.desc") },
    { icon: BarChart3, title: t("features.reports.title"), desc: t("features.reports.desc") },
    { icon: Users, title: t("features.workspace.title"), desc: t("features.workspace.desc") },
    { icon: Shield, title: t("features.security.title"), desc: t("features.security.desc") },
  ];

  const STEPS = [
    { num: "01", title: t("steps.step1.title"), desc: t("steps.step1.desc") },
    { num: "02", title: t("steps.step2.title"), desc: t("steps.step2.desc") },
    { num: "03", title: t("steps.step3.title"), desc: t("steps.step3.desc") },
    { num: "04", title: t("steps.step4.title"), desc: t("steps.step4.desc") },
  ];

  const FAQ_ITEMS = [
    { q: t("faq.q0"), a: t("faq.a0") },
    { q: t("faq.q1"), a: t("faq.a1", { trialDays: PRODUCT_CONFIG.trialDays }) },
    { q: t("faq.q1b"), a: t("faq.a1b") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5", { trialDays: PRODUCT_CONFIG.trialDays }) },
    { q: t("faq.q6"), a: t("faq.a6") },
  ];

  const STATS = [
    [t("hero.stats.onlineValue"), t("hero.stats.onlineLabel")],
    [`${PRODUCT_CONFIG.trialDays} ${t("hero.stats.trialValue")}`, t("hero.stats.trialLabel")],
    [t("hero.stats.syncValue"), t("hero.stats.syncLabel")],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Logo size="sm" />
            <span className="text-gradient-hero">Lumyf</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={`#${l.href}`}
                className="whitespace-nowrap transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/blog"
              className="whitespace-nowrap transition-colors hover:text-foreground"
            >
              Blog
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={theme === "dark" ? t("theme.activateLight") : t("theme.activateDark")}
              title={theme === "dark" ? t("theme.light") : t("theme.dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href={loginHref}
              className="whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("nav.login")}
            </Link>
            <Link
              href={registerHref}
              className="whitespace-nowrap bg-hero-gradient text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              {t("nav.createAccount")}
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-foreground hover:bg-secondary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 pb-5 pt-3 space-y-2">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={`#${l.href}`}
                className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/blog"
              className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Blog
            </Link>
            <div className="pt-2 space-y-2 border-t border-border">
              <div className="flex justify-center py-2">
                <LocaleSwitcher />
              </div>
            <Link
              href={loginHref}
              className="block w-full rounded-lg border border-border px-5 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.login")}
            </Link>
            <Link
              href={registerHref}
              className="block w-full bg-hero-gradient text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg text-center"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.createAccount")}
            </Link>
            <button
              type="button"
              onClick={handleDownloadApp}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-primary/30 bg-primary/5 px-5 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <Download className="h-4 w-4 shrink-0" />
              {t("nav.downloadApp")}
            </button>
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                setMobileOpen(false);
              }}
              className="block w-full rounded-lg border border-border px-5 py-2.5 text-center text-sm font-semibold text-foreground"
            >
              {theme === "dark" ? t("theme.light") : t("theme.dark")}
            </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative pt-28 pb-12 md:pt-29 md:pb-24 px-4 sm:px-6">
        <div
          className="absolute inset-0 -z-10 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(160 45% 30%) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 sm:px-4 py-1.5 text-xs font-semibold text-primary mb-5 sm:mb-6">
            <PiggyBank className="h-3.5 w-3.5" />
            {t("hero.badge")}
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl leading-tight tracking-tight mb-2 sm:mb-3">
            {(() => {
              const highlightStr = t("hero.titleHighlight", { trialDays: PRODUCT_CONFIG.trialDays });
              if (t("hero.titleFormat") === "full") {
                return t("hero.title");
              }
              const titleResolved = t("hero.title", { highlight: highlightStr });

              if (titleResolved.includes(highlightStr)) {
                const [before, ...rest] = titleResolved.split(highlightStr);
                return (
                  <>
                    {before}
                    <span className="text-gradient-hero">{highlightStr}</span>
                    {rest.join(highlightStr)}
                  </>
                );
              }

              return (
                <>
                  {titleResolved} —{" "}
                  <span className="text-gradient-hero">{highlightStr}</span>
                </>
              );
            })()}
          </h1>
          {t("hero.titleFormat") === "full" && (
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gradient-hero mb-4 sm:mb-6">
              {t("hero.titleHighlight", { trialDays: PRODUCT_CONFIG.trialDays })}
            </h2>
          )}
          <div className="max-w-xl mx-auto mt-2 sm:mt-3 mb-8 sm:mb-10">
            <h3 className="text-sm sm:text-base text-muted-foreground font-normal leading-relaxed">{t("hero.subtitle")}</h3>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href={registerHref}
              className="bg-hero-gradient text-primary-foreground font-semibold px-7 sm:px-8 py-3.5 rounded-xl text-sm sm:text-base hover:opacity-90 transition-opacity flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {t("hero.cta", { trialDays: PRODUCT_CONFIG.trialDays })} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#funcionalidades"
              className="text-muted-foreground font-medium flex items-center gap-1.5 hover:text-foreground transition-colors text-sm sm:text-base"
            >
              {t("hero.howItWorks")} <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-10 sm:mt-16 max-w-2xl grid grid-cols-3 gap-3 sm:gap-6 text-center">
          {STATS.map(([val, label]) => (
            <div key={label}>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gradient-hero">{val}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Web app download */}
        <div className="mx-auto mt-8 sm:mt-10 max-w-xl text-center">
          <p className="text-sm sm:text-base text-gradient-hero font-medium">
            {t.rich("hero.subtitleApp", {
              link: (chunks) => (
                <button
                  type="button"
                  onClick={handleDownloadApp}
                  className="text-foreground font-semibold underline underline-offset-2 hover:no-underline cursor-pointer inline"
                >
                  {chunks}
                </button>
              ),
            })}
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funcionalidades" className="py-12 sm:py-20 px-4 sm:px-6 bg-secondary/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3">
              {t("features.title")}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
              {t("features.subtitle")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group bg-card rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300"
              >
                <div
                  className="mb-3 sm:mb-4 inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-secondary text-primary"
                  role="img"
                  aria-label={f.title}
                >
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 font-sans">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="sobre" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3">
            {t("steps.title")}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t("steps.subtitle")}
          </p>
        </div>
        <div className="mx-auto max-w-3xl grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <span className="text-3xl sm:text-4xl font-bold text-accent/30">{s.num}</span>
              <h3 className="text-sm sm:text-base font-semibold mt-2 mb-1 font-sans">{s.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <PlanCard
        ctaVariant={betaToken ? "betaTest" : "register"}
        ctaHref={registerHref}
        sectionId="precos"
      />

      {/* FAQ */}
      <section id="faq" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 mb-3">
              <HelpCircle className="h-6 w-6 sm:h-8 sm:w-8 text-accent" aria-hidden />
              <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tight">
                {t("faq.title")}
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t("faq.subtitle")}
            </p>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="rounded-xl bg-card border border-border overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 text-left text-sm sm:text-base font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  {item.q}
                  <ChevronDown
                    className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    openFaq === i ? "max-h-72" : "max-h-0"
                  }`}
                >
                  <p className="px-4 sm:px-5 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Logo size="lg" className="mx-auto mb-5 sm:mb-6" />
          <h2 className="text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3 sm:mb-4">
            {t("cta.title")}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-md mx-auto">
            {t("cta.subtitle")}
          </p>
          <Link
            href={registerHref}
            className="bg-hero-gradient text-primary-foreground font-semibold px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            {t("cta.button")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 sm:py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
            <Logo size="sm" />
            Lumyf
          </Link>
          <p className="text-xs sm:text-sm text-center">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
            <Link href="/terms" className="hover:text-foreground transition-colors text-xs sm:text-sm">
              {t("footer.terms")}
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors text-xs sm:text-sm">
              {t("footer.privacy")}
            </Link>
            <Link href="/refund" className="hover:text-foreground transition-colors text-xs sm:text-sm">
              {t("footer.refund")}
            </Link>
            <Link href="/acessibilidade" className="hover:text-foreground transition-colors text-xs sm:text-sm">
              {t("footer.accessibility")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

