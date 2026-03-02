import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { LocaleDocumentSync } from "@/components/locale-document-sync";
import { RecoveryRedirect } from "@/components/auth/recovery-redirect";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lumyf.com";

const OG_LOCALE_MAP: Record<string, string> = {
  "pt-BR": "pt_BR",
  "pt-PT": "pt_PT",
  en: "en_US",
  es: "es_ES",
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ogLocale = OG_LOCALE_MAP[locale] ?? "pt_BR";
  const languages: Record<string, string> = {
    "x-default": `${BASE_URL}/${routing.defaultLocale}`,
  };
  for (const l of routing.locales) {
    languages[l] = `${BASE_URL}/${l}`;
  }
  return {
    title: { template: "%s | Lumyf", default: "Lumyf" },
    openGraph: { locale: ogLocale },
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages,
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <RecoveryRedirect />
      <LocaleDocumentSync locale={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
