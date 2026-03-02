import { NextRequest, NextResponse } from "next/server";
import { getCountryFromRequest } from "@/lib/geo/country";

/**
 * GET /api/geo/country
 * Retorna o país detectado (ISO 3166-1 alpha-2) para o usuário.
 * Usado pelo frontend para exibir preço em R$ ou US$ conforme geolocalização.
 */
export async function GET(request: NextRequest) {
  const country = await getCountryFromRequest(request);
  return NextResponse.json({ country: country ?? null });
}
