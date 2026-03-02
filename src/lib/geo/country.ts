/**
 * Detecção de país do usuário para preços e checkout (BRL vs USD).
 * Prioridade: X-Vercel-IP-Country (Vercel) > CF-IPCountry (Cloudflare) > API de IP.
 */
import type { NextRequest } from "next/server";

const GEO_HEADERS = ["x-vercel-ip-country", "cf-ipcountry"] as const;

function getClientIp(headersList: Headers): string | null {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && first !== "::1" && first !== "127.0.0.1") return first;
  }
  const realIp = headersList.get("x-real-ip");
  if (realIp && realIp !== "::1" && realIp !== "127.0.0.1") return realIp;
  return null;
}

async function fetchCountryFromIpApi(ip: string): Promise<string | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { countryCode?: string };
    const code = data?.countryCode;
    return typeof code === "string" && code.length === 2 ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Obtém o país a partir de um objeto Headers (para uso em Server Actions/RSC).
 * Usa X-Vercel-IP-Country, CF-IPCountry ou API de IP como fallback.
 */
export async function getCountryFromHeaders(headersList: Headers): Promise<string | null> {
  for (const name of GEO_HEADERS) {
    const value = headersList.get(name);
    if (value && value.length === 2 && value !== "XX" && value !== "T1") {
      return value.toUpperCase();
    }
  }

  const ip = getClientIp(headersList);
  if (ip) return fetchCountryFromIpApi(ip);

  return null;
}

/**
 * Obtém o país a partir de um NextRequest (para uso em API Routes).
 */
export async function getCountryFromRequest(request: NextRequest): Promise<string | null> {
  for (const name of GEO_HEADERS) {
    const value = request.headers.get(name);
    if (value && value.length === 2 && value !== "XX" && value !== "T1") {
      return value.toUpperCase();
    }
  }

  const ip = getClientIp(request.headers);
  if (ip) return fetchCountryFromIpApi(ip);

  return null;
}

/**
 * Detecta se o usuário está no Brasil para escolher preço BRL vs USD.
 * Retorna true para BR, false para qualquer outro país ou null (default USD).
 */
export function isBrazil(country: string | null): boolean {
  return country?.toUpperCase() === "BR";
}
