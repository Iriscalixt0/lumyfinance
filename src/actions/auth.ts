"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

/**
 * Exclui a conta do usuário autenticado.
 * Usa service role no servidor para auth.admin.deleteUser.
 * Nunca exponha SUPABASE_SERVICE_ROLE_KEY no client.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { ok: false, error: "Configuração do servidor indisponível." };
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    user.id
  );

  if (deleteError) {
    return {
      ok: false,
      error: deleteError.message ?? "Não foi possível excluir a conta.",
    };
  }

  return { ok: true };
}
