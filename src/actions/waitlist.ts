"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const schema = z.object({
  email: z.string().trim().email("Email inválido"),
  name: z.string().trim().max(80).optional(),
});

export type WaitlistResult =
  | { ok: true }
  | { ok: false; error: string };

export async function joinWaitlist(
  input: z.infer<typeof schema>
): Promise<WaitlistResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuração." };

  const { email, name } = parsed.data;

  try {
    await admin.from("waitlist_emails").upsert(
      { email, name: name || null },
      { onConflict: "email", ignoreDuplicates: true }
    );
  } catch {
    // Tabela pode não existir ainda — não quebra o app
    return { ok: true };
  }

  return { ok: true };
}
