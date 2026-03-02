import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { LandingStructuredData } from "@/components/landing/LandingStructuredData";
import { LandingLocationRequest } from "@/components/onboarding/location-consent-modal";
import { routing } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lumyf.com";

const OG_LOCALE_MAP: Record<string, string> = {
  "pt-BR": "pt_BR",
  "pt-PT": "pt_PT",
  en: "en_US",
  es: "es_ES",
};

// Locale-native SEO copy so every language version has unique, culturally accurate text
const LOCALE_META: Record<
  string,
  { title: string; description: string; keywords: string[] }
> = {
  "pt-BR": {
    title: "Lumyf – App de Gestão Financeira Pessoal e Familiar | Grátis",
    description:
      "App gratuito para controle financeiro pessoal e compartilhado. Registre receitas, despesas, investimentos e metas. Ideal para casais e famílias. Sem cartão de crédito.",
    keywords: [
      "app gestão financeira",
      "controle de gastos",
      "app orçamento familiar",
      "controle financeiro casal",
      "app finanças grátis",
      "planilha de gastos mensal",
      "app controle financeiro",
    ],
  },
  "pt-PT": {
    title: "Lumyf – App de Gestão Financeira Pessoal e Familiar | Grátis",
    description:
      "Aplicação gratuita de gestão financeira pessoal com partilha familiar. Controle receitas, despesas, investimentos e metas. Para casais e famílias.",
    keywords: [
      "app gestão financeira",
      "controlo de gastos",
      "orçamento familiar",
      "finanças pessoais",
      "app finanças grátis",
    ],
  },
  en: {
    title: "Lumyf – Free Personal Finance & Family Budgeting App",
    description:
      "Free app to track income, expenses, investments and financial goals — with flexible family sharing. Start free, no credit card required.",
    keywords: [
      "personal finance app",
      "family budget app",
      "expense tracker",
      "budget planner",
      "money management app",
      "free finance app",
      "household budget tracker",
    ],
  },
  es: {
    title: "Lumyf – App de Finanzas Personales y Familiares | Gratis",
    description:
      "App gratuita para controlar ingresos, gastos, inversiones y metas financieras. Compartible con tu pareja o familia. Sin tarjeta de crédito.",
    keywords: [
      "app finanzas personales",
      "control de gastos",
      "presupuesto familiar",
      "app finanzas gratis",
      "gestión financiera familiar",
    ],
  },
};

function getLocaleMeta(locale: string) {
  return LOCALE_META[locale] ?? LOCALE_META["en"];
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ beta?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const meta = getLocaleMeta(locale);
  const ogLocale = OG_LOCALE_MAP[locale] ?? "en_US";
  const pageUrl = `${BASE_URL}/${locale}`;

  // Build hreflang alternates for every supported locale + x-default
  const languages: Record<string, string> = {
    "x-default": `${BASE_URL}/${routing.defaultLocale}`,
  };
  for (const l of routing.locales) {
    languages[l] = `${BASE_URL}/${l}`;
  }

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    authors: [{ name: "Lumyf" }],
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      locale: ogLocale,
      url: pageUrl,
      siteName: "Lumyf",
      images: [
        {
          url: `${BASE_URL}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: "Lumyf – Personal & Family Finance App",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [`${BASE_URL}/og-image.jpg`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: pageUrl,
      languages,
    },
  };
}

export default async function HomePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const betaToken = typeof sp.beta === "string" ? sp.beta.trim() : "";
  return (
    <>
      <LandingLocationRequest />
      <LandingStructuredData />
      <LandingPage betaToken={betaToken || undefined} />
    </>
  );
}
