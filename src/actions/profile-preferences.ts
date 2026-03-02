"use server";

import { createClient } from "@/lib/supabase/server";

/** Geocodificação reversa: coordenadas → país, região, cidade (via OpenStreetMap Nominatim). */
export async function reverseGeocode(lat: number, lon: number): Promise<{
  ok: boolean;
  country?: string;
  region?: string;
  city?: string;
  error?: string;
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Lumyf-App/1.0 (finance-saas)",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return { ok: false, error: "Geocoding failed" };
    }
    const data = (await res.json()) as {
      address?: {
        country?: string;
        state?: string;
        region?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
      };
    };
    const addr = data.address ?? {};
    const country = addr.country ?? undefined;
    const region = addr.state ?? addr.region ?? undefined;
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? undefined;
    return { ok: true, country, region, city };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
import { z } from "zod";

const locationConsentSchema = z.object({
  consent: z.boolean(),
  permissionState: z.enum(["unknown", "granted", "denied"]).default("unknown"),
  timezone: z.string().trim().min(1).max(100).nullable().optional(),
  localeHint: z.string().trim().min(1).max(20).nullable().optional(),
  countryHint: z.string().trim().min(1).max(80).nullable().optional(),
  regionHint: z.string().trim().min(1).max(120).nullable().optional(),
  cityHint: z.string().trim().min(1).max(120).nullable().optional(),
});

export type SaveLocationConsentInput = z.infer<typeof locationConsentSchema>;

export async function saveLocationConsent(input: SaveLocationConsentInput) {
  const parsed = locationConsentSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Nao autorizado." };
  }

  const payload = {
    user_id: user.id,
    location_consent: parsed.consent,
    location_permission_state: parsed.permissionState,
    timezone: parsed.timezone ?? null,
    locale_hint: parsed.localeHint ?? null,
    country_hint: parsed.countryHint ?? null,
    region_hint: parsed.regionHint ?? null,
    city_hint: parsed.cityHint ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profile_preferences").upsert(payload, { onConflict: "user_id" });
  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
}
