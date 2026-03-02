import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lumyf.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Build the hreflang alternates map shared across all entries
  const languages: Record<string, string> = {
    "x-default": `${BASE_URL}/${routing.defaultLocale}`,
  };
  for (const locale of routing.locales) {
    languages[locale] = `${BASE_URL}/${locale}`;
  }

  return routing.locales.map((locale) => ({
    url: `${BASE_URL}/${locale}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: locale === routing.defaultLocale ? 1.0 : 0.8,
    alternates: { languages },
  }));
}
