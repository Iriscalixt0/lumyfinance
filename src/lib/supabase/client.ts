import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigIsSafe } from "@/lib/supabase/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Configure o Supabase: crie o arquivo .env.local na pasta lumyf-saas com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja .env.example). Depois reinicie o servidor (npm run dev)."
    );
  }

  assertSupabaseConfigIsSafe(supabaseUrl, supabaseAnonKey);

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: "pkce" },
  });
}
