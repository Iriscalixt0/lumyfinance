function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  try {
    const decoded =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractProjectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([^.]+)\.supabase\.co$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function assertSupabaseConfigIsSafe(url: string, key: string) {
  const payload = decodeJwtPayload(key);
  const role = typeof payload?.role === "string" ? payload.role : null;
  const keyRef = typeof payload?.ref === "string" ? payload.ref : null;
  const urlRef = extractProjectRefFromUrl(url);

  if (role === "service_role") {
    throw new Error(
      "Configuracao invalida: NEXT_PUBLIC_SUPABASE_ANON_KEY esta usando service_role. Use a chave publica anon do Supabase (Settings > API)."
    );
  }

  if (keyRef && urlRef && keyRef !== urlRef) {
    throw new Error(
      `Configuracao invalida: NEXT_PUBLIC_SUPABASE_URL aponta para '${urlRef}', mas NEXT_PUBLIC_SUPABASE_ANON_KEY e do projeto '${keyRef}'. Use URL e anon key do mesmo projeto.`
    );
  }
}
