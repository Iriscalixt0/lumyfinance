import { Link } from "react-router-dom";
import heroPhoneMockup from "@/assets/hero-phone-mockup.png";
import { PRODUCT_CONFIG } from "@/lib/product-config";
import { useState } from "react";
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
  Check,
  Quote,
  ShieldCheck,
  Lock,
  Eye,
  Landmark,
} from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTranslations, useLocale } from "@/lib/i18n";
import { getPlanPriceByLocale } from "@/lib/product-config";
import { motion } from "framer-motion";

/* ── Animation variants ── */
const ease = [0.25, 0.1, 0.25, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const phoneFLoat = {
  hidden: { opacity: 0, y: 60, scale: 0.92 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: "easeOut" as const, delay: 0.3 } },
};

export function LandingPage() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const loginHref = "/login";
  const registerHref = "/register";

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

  const TESTIMONIALS = [
    { quote: t("testimonials.q0"), author: t("testimonials.a0"), location: t("testimonials.l0") },
    { quote: t("testimonials.q1"), author: t("testimonials.a1"), location: t("testimonials.l1") },
    { quote: t("testimonials.q2"), author: t("testimonials.a2"), location: t("testimonials.l2") },
    { quote: t("testimonials.q3"), author: t("testimonials.a3"), location: t("testimonials.l3") },
  ];

  const SECURITY_ITEMS = [
    { icon: ShieldCheck, title: t("features.security.title"), desc: t("features.security.desc") },
    { icon: Lock, title: "Dados criptografados", desc: "Seus dados são protegidos com criptografia de ponta a ponta." },
    { icon: Eye, title: "Somente leitura", desc: "Nós nunca acessamos suas contas bancárias nem fazemos transações." },
    { icon: Landmark, title: "Controle total", desc: "Você registra tudo manualmente. Seus dados são só seus." },
  ];

  const priceInfo = getPlanPriceByLocale(locale);
  const formattedPrice = priceInfo.formatted;

  const planFeatures = [
    t("plans.pro.features.trial", { trialDays: PRODUCT_CONFIG.trialDays }),
    t("plans.pro.features.workspaces", { count: PRODUCT_CONFIG.maxWorkspaces }),
    t("plans.pro.features.members", { count: PRODUCT_CONFIG.maxMembersPerWorkspace }),
    t("plans.pro.features.unlimitedTransactions"),
    t("plans.pro.features.unlimitedGoals"),
    t("plans.pro.features.advancedReports"),
    t("plans.pro.features.prioritySupport"),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-5xl flex items-center justify-between rounded-full border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl px-5 sm:px-6 py-3"
        >
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Logo size="sm" />
            <span className="bg-gradient-to-r from-[hsl(160,45%,45%)] to-[hsl(160,45%,60%)] bg-clip-text text-transparent">
              Lumyf
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={`#${l.href}`} className="whitespace-nowrap transition-colors hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher />
            <Link to={loginHref} className="whitespace-nowrap text-sm font-medium text-white/70 hover:text-white transition-colors px-4 py-2 rounded-full border border-white/10 hover:border-white/25">
              {t("nav.login")}
            </Link>
            <Link
              to={registerHref}
              className="whitespace-nowrap bg-white text-[#0a0a0a] text-sm font-semibold px-5 py-2 rounded-full hover:bg-white/90 transition-colors"
            >
              {t("nav.createAccount")}
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </motion.div>

        {mobileOpen && (
          <div className="md:hidden mt-2 mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl px-5 pb-5 pt-3 space-y-2">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={`#${l.href}`}
                className="block py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 space-y-2 border-t border-white/10">
              <div className="flex justify-center py-2">
                <LocaleSwitcher />
              </div>
              <Link
                to={loginHref}
                className="block w-full rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/5 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {t("nav.login")}
              </Link>
              <Link
                to={registerHref}
                className="block w-full bg-white text-[#0a0a0a] text-sm font-semibold px-5 py-2.5 rounded-full text-center hover:bg-white/90 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {t("nav.createAccount")}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[hsl(160,45%,30%)]/10 blur-[120px]" />
        </div>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
            {t("hero.title")}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-base sm:text-lg md:text-xl text-white/50 font-normal leading-relaxed max-w-xl mx-auto mb-10">
            {t("hero.subtitle")}
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={registerHref}
              className="bg-white text-[#0a0a0a] font-semibold px-8 py-3.5 rounded-full text-sm sm:text-base hover:bg-white/90 hover:scale-105 transition-all duration-200 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {t("hero.cta", { trialDays: PRODUCT_CONFIG.trialDays })}
            </Link>
            <a
              href="#funcionalidades"
              className="text-white/50 font-medium flex items-center gap-1.5 hover:text-white transition-colors text-sm sm:text-base"
            >
              {t("hero.howItWorks")} <ChevronRight className="h-4 w-4" />
            </a>
          </motion.div>
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3 mt-8">
            {["100% online", `${PRODUCT_CONFIG.trialDays} dias grátis`, "Sem cartão"].map((pill) => (
              <span key={pill} className="text-xs text-white/40 border border-white/10 rounded-full px-4 py-1.5">
                {pill}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Phone Mockup — floating entrance */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={phoneFLoat}
          className="relative mt-12 sm:mt-20 flex justify-center"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-[260px] sm:w-[300px] md:w-[340px]"
          >
            <div className="absolute -inset-8 sm:-inset-12 bg-[hsl(160,45%,35%)]/8 rounded-full blur-[80px] -z-10" />
            <img
              src={heroPhoneMockup}
              alt="Lumyf app dashboard mockup"
              width={800}
              height={1200}
              className="w-full h-auto drop-shadow-2xl"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="funcionalidades" className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12 sm:mb-20"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{t("features.title")}</h2>
            <p className="text-sm sm:text-base text-white/40 max-w-lg mx-auto">{t("features.subtitle")}</p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={cardVariant}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-7 hover:border-white/[0.12] hover:bg-white/[0.04] transition-colors duration-300"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(160,45%,40%)]/10 text-[hsl(160,45%,55%)]">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="sobre" className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12 sm:mb-20"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{t("steps.title")}</h2>
            <p className="text-sm sm:text-base text-white/40">{t("steps.subtitle")}</p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
          >
            {STEPS.map((s, i) => (
              <motion.div key={s.num} variants={cardVariant} className="text-center relative">
                <span className="text-5xl sm:text-6xl font-black text-[hsl(160,45%,45%)]/15">{s.num}</span>
                <h3 className="text-sm sm:text-base font-bold mt-2 mb-2">{s.title}</h3>
                <p className="text-xs sm:text-sm text-white/40">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-4 w-8 border-t border-dashed border-white/10" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12 sm:mb-20"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              {t("testimonials.title")}
            </h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={stagger}
            className="grid sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto"
          >
            {TESTIMONIALS.map((item, i) => (
              <motion.div
                key={i}
                variants={cardVariant}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-7 hover:border-white/[0.12] transition-colors duration-300"
              >
                <Quote className="absolute top-5 right-5 h-5 w-5 text-[hsl(160,45%,45%)]/20" aria-hidden />
                <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-5 italic">
                  "{item.quote}"
                </p>
                <div className="text-sm">
                  <span className="font-semibold text-white">{item.author}</span>
                  <span className="text-white/40">, {item.location}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Como protegemos seus dados
            </h2>
            <p className="text-sm sm:text-base text-white/40 max-w-lg mx-auto">
              Segurança nível bancário. Os mesmos padrões dos maiores bancos do país.
            </p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {SECURITY_ITEMS.map((item) => (
              <motion.div
                key={item.title}
                variants={cardVariant}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 text-center hover:border-white/[0.12] transition-colors duration-300"
              >
                <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                  <item.icon className="h-5 w-5 text-white/60" aria-hidden />
                </div>
                <h3 className="text-sm font-bold mb-2">{item.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precos" className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              {t("pricing.title")}
            </h2>
            <p className="text-sm sm:text-base text-white/40 max-w-lg mx-auto">
              {t("pricing.subtext", { price: formattedPrice, trialDays: PRODUCT_CONFIG.trialDays })}
            </p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="max-w-md mx-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 sm:p-8 relative"
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(160,45%,45%)] text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
              {t("plans.pro.badge")}
            </span>
            <h3 className="text-lg font-bold">{t("plans.pro.name")}</h3>
            <p className="text-sm text-white/40 mt-1">
              {t("plans.pro.desc", { trialDays: PRODUCT_CONFIG.trialDays })}
            </p>
            <div className="mt-5 mb-6">
              <span className="text-4xl sm:text-5xl font-black">{formattedPrice}</span>
              <span className="text-sm text-white/40">{t("plans.pro.period")}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(160,45%,55%)]" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={registerHref}
              className="block w-full py-3.5 rounded-full font-semibold text-sm text-center bg-white text-[#0a0a0a] hover:bg-white/90 hover:scale-[1.02] transition-all duration-200"
            >
              {t("plans.pro.cta", { trialDays: PRODUCT_CONFIG.trialDays })}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{t("faq.title")}</h2>
            <p className="text-sm sm:text-base text-white/40">{t("faq.subtitle")}</p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="space-y-3"
          >
            {FAQ_ITEMS.map((item, i) => (
              <motion.div key={i} variants={cardVariant} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left text-sm sm:text-base font-medium text-white hover:bg-white/[0.03] transition-colors"
                >
                  {item.q}
                  <ChevronDown className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-white/30 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${openFaq === i ? "max-h-72" : "max-h-0"}`}>
                  <p className="px-5 sm:px-6 pb-5 pt-0 text-sm text-white/40 leading-relaxed">{item.a}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 sm:py-28 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="mx-auto max-w-2xl text-center"
        >
          <Logo size="lg" className="mx-auto mb-6" />
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{t("cta.title")}</h2>
          <p className="text-sm sm:text-base text-white/40 mb-8 max-w-md mx-auto">{t("cta.subtitle")}</p>
          <Link
            to={registerHref}
            className="bg-white text-[#0a0a0a] font-semibold px-10 py-4 rounded-full text-sm sm:text-base hover:bg-white/90 hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
          >
            {t("cta.button")} <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-5 text-sm text-white/40 sm:flex-row sm:justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-white">
            <Logo size="sm" />
            Lumyf
          </Link>
          <p className="text-xs sm:text-sm text-center">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link to="/terms" className="hover:text-white transition-colors text-xs sm:text-sm">{t("footer.terms")}</Link>
            <Link to="/privacy" className="hover:text-white transition-colors text-xs sm:text-sm">{t("footer.privacy")}</Link>
            <Link to="/refund" className="hover:text-white transition-colors text-xs sm:text-sm">{t("footer.refund")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
