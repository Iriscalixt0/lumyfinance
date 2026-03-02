"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isBetaAdmin(email: string | undefined): boolean {
  return isPrivilegedAdminEmail(email);
}

export type BetaFeedbackItem = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string;
  program_name: string;
  feedback_text: string;
  feedback_upgraded: boolean;
  feedback_at: string;
};

export async function getAllBetaFeedbacks(): Promise<BetaFeedbackItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return [];
  }

  const admin = getAdminClient();
  if (!admin) return [];

  const { data: participants, error } = await admin
    .from("beta_participants")
    .select(
      "id, user_id, feedback_text, feedback_upgraded, feedback_at, beta_program_id"
    )
    .not("feedback_text", "is", null)
    .order("feedback_at", { ascending: false });

  if (error || !participants?.length) return [];

  const programIds = [...new Set(participants.map((p) => p.beta_program_id))];
  const { data: programs } = await admin
    .from("beta_programs")
    .select("id, name")
    .in("id", programIds);
  const programMap = new Map(
    (programs ?? []).map((p) => [p.id, p.name])
  );

  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? "—"])
  );

  const results: BetaFeedbackItem[] = [];
  for (const p of participants) {
    let userEmail: string | null = null;
    let authName: string | null = null;
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(p.user_id);
      userEmail = authUser?.user?.email ?? null;
      authName =
        (authUser?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
        null;
    } catch {
      // ignora se não conseguir buscar email
    }
    results.push({
      id: p.id,
      user_id: p.user_id,
      user_email: userEmail,
      user_name: (() => {
        const profileName = profileMap.get(p.user_id);
        const fallbackNameFromEmail = userEmail ? userEmail.split("@")[0] : null;
        if (profileName && profileName !== "—") return profileName;
        return authName ?? fallbackNameFromEmail ?? "—";
      })(),
      program_name: programMap.get(p.beta_program_id) ?? "—",
      feedback_text: p.feedback_text ?? "",
      feedback_upgraded: p.feedback_upgraded ?? false,
      feedback_at: p.feedback_at ?? "",
    });
  }
  return results;
}

export type OnboardingIntentStats = {
  intent: string;
  label: string;
  count: number;
  percentage: number;
  details?: string[]; // para "other", lista de onboarding_intent_detail únicos
};

export type OnboardingStats = {
  total: number;
  byIntent: OnboardingIntentStats[];
};

const INTENT_LABELS: Record<string, string> = {
  personal: "Uso pessoal",
  family: "Família",
  business: "Negócios",
  other: "Outro",
  unknown: "Não informado",
};

export async function getOnboardingStats(): Promise<OnboardingStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return { total: 0, byIntent: [] };
  }

  const admin = getAdminClient();
  if (!admin) return { total: 0, byIntent: [] };

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("onboarding_intent, onboarding_intent_detail")
    .not("onboarding_completed_at", "is", null);

  if (error || !profiles) return { total: 0, byIntent: [] };

  const total = profiles.length;
  const byIntentMap = new Map<
    string,
    { count: number; details: Set<string> }
  >();

  for (const p of profiles) {
    const intent = p.onboarding_intent ?? "unknown";
    if (!byIntentMap.has(intent)) {
      byIntentMap.set(intent, { count: 0, details: new Set() });
    }
    const entry = byIntentMap.get(intent)!;
    entry.count += 1;
    if (intent === "other" && p.onboarding_intent_detail?.trim()) {
      entry.details.add(p.onboarding_intent_detail.trim());
    }
  }

  const byIntent: OnboardingIntentStats[] = [];
  for (const [intent, { count, details }] of byIntentMap.entries()) {
    byIntent.push({
      intent,
      label: INTENT_LABELS[intent] ?? intent,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
      details:
        intent === "other" && details.size > 0
          ? [...details].filter(Boolean).slice(0, 50)
          : undefined,
    });
  }

  byIntent.sort((a, b) => b.count - a.count);
  return { total, byIntent };
}

export type UserLocaleStatsItem = {
  locale: string;
  label: string;
  count: number;
  percentage: number;
  beta: number;
  normal: number;
};

export type UserCountryStatsItem = {
  country: string;
  count: number;
  beta: number;
  normal: number;
};

export type UserRegionStatsItem = {
  region: string;
  count: number;
  beta: number;
  normal: number;
};

export type UserCityStatsItem = {
  city: string;
  count: number;
  beta: number;
  normal: number;
};

export type UserLocaleStats = {
  totalUsers: number;
  totalBeta: number;
  totalNormal: number;
  totalWithGeolocation: number;
  byLocale: UserLocaleStatsItem[];
  byCountry: UserCountryStatsItem[];
  byRegion: UserRegionStatsItem[];
  byCity: UserCityStatsItem[];
};

export type BetaLeadItem = {
  user_id: string;
  user_name: string;
  user_email: string | null;
  whatsapp_e164: string | null;
  marketing_email_opt_in: boolean;
  marketing_whatsapp_opt_in: boolean;
  status: string;
  blocked_at: string | null;
  data_delete_after: string | null;
  upgraded_at: string | null;
  feedback_at: string | null;
  program_name: string;
};

export type BetaConversionStats = {
  totalBlocked: number;
  totalUpgraded: number;
  expiringSoon: number;
  channelSent: { in_app: number; email: number; whatsapp: number };
  channelFailed: { in_app: number; email: number; whatsapp: number };
};

const LOCALE_LABELS: Record<string, string> = {
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  en: "English",
  es: "Español",
  unknown: "Não informado",
};

export async function getUserLocaleStats(): Promise<UserLocaleStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return {
      totalUsers: 0,
      totalBeta: 0,
      totalNormal: 0,
      totalWithGeolocation: 0,
      byLocale: [],
      byCountry: [],
      byRegion: [],
      byCity: [],
    };
  }

  const admin = getAdminClient();
  if (!admin)
    return {
      totalUsers: 0,
      totalBeta: 0,
      totalNormal: 0,
      totalWithGeolocation: 0,
      byLocale: [],
      byCountry: [],
      byRegion: [],
      byCity: [],
    };

  const { data: betaParticipantUserIds } = await admin
    .from("beta_participants")
    .select("user_id");
  const betaSet = new Set(
    (betaParticipantUserIds ?? []).map((b) => b.user_id)
  );

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id")
    .not("onboarding_completed_at", "is", null);

  if (error || !profiles?.length)
    return {
      totalUsers: 0,
      totalBeta: 0,
      totalNormal: 0,
      totalWithGeolocation: 0,
      byLocale: [],
      byCountry: [],
      byRegion: [],
      byCity: [],
    };

  const userIds = profiles.map((p) => p.id);
  const { data: prefs } = await admin
    .from("profile_preferences")
    .select("user_id, locale_hint, country_hint, region_hint, city_hint")
    .in("user_id", userIds);

  const prefsByUser = new Map(
    (prefs ?? []).map((p) => [
      p.user_id,
      {
        locale: (p.locale_hint?.trim() || "unknown") as string,
        country: (p.country_hint?.trim() || "unknown") as string,
        region: (p.region_hint?.trim() || "unknown") as string,
        city: (p.city_hint?.trim() || "unknown") as string,
      },
    ])
  );

  let totalBeta = 0;
  let totalNormal = 0;
  let totalWithGeolocation = 0;
  const byLocaleMap = new Map<
    string,
    { count: number; beta: number; normal: number }
  >();
  const byCountryMap = new Map<
    string,
    { count: number; beta: number; normal: number }
  >();
  const byRegionMap = new Map<
    string,
    { count: number; beta: number; normal: number }
  >();
  const byCityMap = new Map<
    string,
    { count: number; beta: number; normal: number }
  >();

  for (const p of profiles) {
    const isBeta = betaSet.has(p.id);
    if (isBeta) totalBeta++;
    else totalNormal++;

    const pref = prefsByUser.get(p.id);
    const locale = pref?.locale ?? "unknown";
    const country = pref?.country ?? "unknown";
    const region = pref?.region ?? "unknown";
    const city = pref?.city ?? "unknown";

    if (country !== "unknown" || region !== "unknown" || city !== "unknown") {
      totalWithGeolocation += 1;
    }

    if (!byLocaleMap.has(locale))
      byLocaleMap.set(locale, { count: 0, beta: 0, normal: 0 });
    const loc = byLocaleMap.get(locale)!;
    loc.count += 1;
    if (isBeta) loc.beta += 1;
    else loc.normal += 1;

    if (!byCountryMap.has(country))
      byCountryMap.set(country, { count: 0, beta: 0, normal: 0 });
    const ctry = byCountryMap.get(country)!;
    ctry.count += 1;
    if (isBeta) ctry.beta += 1;
    else ctry.normal += 1;

    if (region !== "unknown") {
      if (!byRegionMap.has(region))
        byRegionMap.set(region, { count: 0, beta: 0, normal: 0 });
      const r = byRegionMap.get(region)!;
      r.count += 1;
      if (isBeta) r.beta += 1;
      else r.normal += 1;
    }

    if (city !== "unknown") {
      if (!byCityMap.has(city))
        byCityMap.set(city, { count: 0, beta: 0, normal: 0 });
      const c = byCityMap.get(city)!;
      c.count += 1;
      if (isBeta) c.beta += 1;
      else c.normal += 1;
    }
  }

  const totalUsers = profiles.length;
  const byLocale: UserLocaleStatsItem[] = [];
  for (const [locale, { count, beta, normal }] of byLocaleMap.entries()) {
    byLocale.push({
      locale,
      label: LOCALE_LABELS[locale] ?? locale,
      count,
      percentage:
        totalUsers > 0 ? Math.round((count / totalUsers) * 100 * 10) / 10 : 0,
      beta,
      normal,
    });
  }
  byLocale.sort((a, b) => b.count - a.count);

  const byCountry: UserCountryStatsItem[] = [];
  for (const [country, { count, beta, normal }] of byCountryMap.entries()) {
    byCountry.push({ country, count, beta, normal });
  }
  byCountry.sort((a, b) => b.count - a.count);

  const byRegion: UserRegionStatsItem[] = [];
  for (const [region, { count, beta, normal }] of byRegionMap.entries()) {
    byRegion.push({ region, count, beta, normal });
  }
  byRegion.sort((a, b) => b.count - a.count);

  const byCity: UserCityStatsItem[] = [];
  for (const [city, { count, beta, normal }] of byCityMap.entries()) {
    byCity.push({ city, count, beta, normal });
  }
  byCity.sort((a, b) => b.count - a.count);

  return {
    totalUsers,
    totalBeta,
    totalNormal,
    totalWithGeolocation,
    byLocale,
    byCountry,
    byRegion,
    byCity,
  };
}

export async function getBetaConversionStats(): Promise<BetaConversionStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) {
    return {
      totalBlocked: 0,
      totalUpgraded: 0,
      expiringSoon: 0,
      channelSent: { in_app: 0, email: 0, whatsapp: 0 },
      channelFailed: { in_app: 0, email: 0, whatsapp: 0 },
    };
  }

  const admin = getAdminClient();
  if (!admin) {
    return {
      totalBlocked: 0,
      totalUpgraded: 0,
      expiringSoon: 0,
      channelSent: { in_app: 0, email: 0, whatsapp: 0 },
      channelFailed: { in_app: 0, email: 0, whatsapp: 0 },
    };
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const [{ count: blockedCount }, { count: upgradedCount }, { data: expiringRows }, { data: events }] = await Promise.all([
    admin
      .from("beta_participants")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked"),
    admin
      .from("beta_participants")
      .select("id", { count: "exact", head: true })
      .eq("status", "upgraded"),
    admin
      .from("beta_participants")
      .select("id")
      .eq("status", "blocked")
      .not("data_delete_after", "is", null)
      .lte("data_delete_after", soon),
    admin
      .from("beta_conversion_campaign_events")
      .select("channel, status"),
  ]);

  const sent = { in_app: 0, email: 0, whatsapp: 0 };
  const failed = { in_app: 0, email: 0, whatsapp: 0 };

  for (const e of events ?? []) {
    if (e.status === "sent") {
      sent[e.channel as "in_app" | "email" | "whatsapp"] += 1;
    }
    if (e.status === "failed") {
      failed[e.channel as "in_app" | "email" | "whatsapp"] += 1;
    }
  }

  return {
    totalBlocked: blockedCount ?? 0,
    totalUpgraded: upgradedCount ?? 0,
    expiringSoon: (expiringRows ?? []).length,
    channelSent: sent,
    channelFailed: failed,
  };
}

export async function getBetaLeadsForExport(): Promise<BetaLeadItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isBetaAdmin(user.email ?? undefined)) return [];

  const admin = getAdminClient();
  if (!admin) return [];

  const { data: participants, error } = await admin
    .from("beta_participants")
    .select(
      "user_id, status, blocked_at, data_delete_after, upgraded_at, feedback_at, beta_program_id"
    )
    .order("blocked_at", { ascending: false });

  if (error || !participants?.length) return [];

  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const programIds = [...new Set(participants.map((p) => p.beta_program_id))];

  const [{ data: profiles }, { data: prefs }, { data: programs }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", userIds),
    admin
      .from("beta_contact_preferences")
      .select("user_id, whatsapp_e164, marketing_email_opt_in, marketing_whatsapp_opt_in")
      .in("user_id", userIds),
    admin.from("beta_programs").select("id, name").in("id", programIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));
  const programMap = new Map((programs ?? []).map((p) => [p.id, p.name]));

  const result: BetaLeadItem[] = [];
  for (const row of participants) {
    let userEmail: string | null = null;
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
      userEmail = authUser.user?.email ?? null;
    } catch {
      userEmail = null;
    }

    const profile = profileMap.get(row.user_id);
    const pref = prefMap.get(row.user_id);
    result.push({
      user_id: row.user_id,
      user_name: profile?.full_name ?? "—",
      user_email: userEmail,
      whatsapp_e164: pref?.whatsapp_e164 ?? null,
      marketing_email_opt_in: !!pref?.marketing_email_opt_in,
      marketing_whatsapp_opt_in: !!pref?.marketing_whatsapp_opt_in,
      status: row.status,
      blocked_at: row.blocked_at,
      data_delete_after: row.data_delete_after,
      upgraded_at: row.upgraded_at,
      feedback_at: row.feedback_at,
      program_name: programMap.get(row.beta_program_id) ?? "—",
    });
  }

  return result;
}
