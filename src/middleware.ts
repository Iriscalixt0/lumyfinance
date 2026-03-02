import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

const LOCALE_COOKIE = "NEXT_LOCALE";

function parseAcceptLanguage(headerValue: string | null): string[] {
  if (!headerValue) return [];

  return headerValue
    .split(",")
    .map((part) => {
      const [tag, qSegment] = part.trim().split(";q=");
      const q = qSegment ? parseFloat(qSegment) : 1;
      return { tag: tag?.toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((item) => !!item.tag && item.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((item) => item.tag as string);
}

/** Mapeia código de país (ISO 3166-1 alpha-2) para locale. Só pt-BR, pt-PT e en. */
const COUNTRY_TO_LOCALE: Record<string, (typeof routing.locales)[number]> = {
  BR: "pt-BR",
  PT: "pt-PT",
  US: "en",
  GB: "en",
  CA: "en",
  SG: "en",
  ES: "es",
  DE: "en",
  CH: "en",
  FR: "en",
  IT: "en",
  DK: "en",
  NO: "en",
  SE: "en",
  IL: "en",
  CN: "en",
  HK: "en",
};

function pickLocaleFromGeo(request: NextRequest): (typeof routing.locales)[number] | null {
  const country =
    request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? null;
  if (!country || country.length !== 2) return null;
  const locale = COUNTRY_TO_LOCALE[country.toUpperCase()];
  return locale ?? null;
}

function pickLocaleFromAcceptLanguage(headerValue: string | null) {
  const accepted = parseAcceptLanguage(headerValue);
  if (!accepted.length) return routing.defaultLocale;

  const locales = routing.locales;
  const exactMatchMap = new Map(locales.map((locale) => [locale.toLowerCase(), locale]));

  for (const tag of accepted) {
    const exact = exactMatchMap.get(tag);
    if (exact) return exact;
  }

  for (const tag of accepted) {
    const [language, region] = tag.split("-");

    if (language === "pt") {
      if (region === "pt") return "pt-PT";
      return "pt-BR";
    }

    const byLanguage = locales.find((locale) => locale.toLowerCase() === language);
    if (byLanguage) return byLanguage;
  }

  return routing.defaultLocale;
}

function pathHasLocale(pathname: string): boolean {
  const segment = pathname.split("/").filter(Boolean)[0];
  return !!segment && routing.locales.includes(segment as (typeof routing.locales)[number]);
}

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);

  if (sessionResponse.status >= 300 && sessionResponse.status < 400) {
    return sessionResponse;
  }

  const pathname = request.nextUrl.pathname;
  const hasLocaleInPath = pathHasLocale(pathname);
  const localeCookie = request.cookies.get(LOCALE_COOKIE)?.value;

  // Detecção: cookie > geolocalização (país) > Accept-Language do navegador
  if (!hasLocaleInPath && !localeCookie) {
    const fromGeo = pickLocaleFromGeo(request);
    const fromBrowser = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
    const preferred = fromGeo ?? fromBrowser;
    const basePath = pathname === "/" ? "" : pathname;
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${basePath}`;
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.cookies.set(LOCALE_COOKIE, preferred, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    sessionResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value, c);
    });
    return redirectResponse;
  }

  const intlResponse = handleI18nRouting(request);

  if (!localeCookie) {
    const fromGeo = pickLocaleFromGeo(request);
    const fromBrowser = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
    const preferred = fromGeo ?? fromBrowser;
    intlResponse.cookies.set(LOCALE_COOKIE, preferred, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  sessionResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|faviconn.svg|icon|icon.png|icon-|apple-touch-icon|api|manifest.json|pig.png).*)",
  ],
};
