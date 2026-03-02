"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cookies } from "next/headers";

const intentSchema = z.enum(["personal", "family", "business", "other"]);
const intentDetailSchema = z.string().trim().max(220).nullable().optional();
const workspaceNameSchema = z
  .string()
  .min(1, "Nome é obrigatório")
  .max(100, "Nome muito longo");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "workspace";
}

export async function saveOnboardingIntent(
  intent: z.infer<typeof intentSchema>,
  intentDetail?: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = intentSchema.parse(intent);
  const parsedDetail = intentDetailSchema.parse(intentDetail);

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_intent: parsed,
      onboarding_intent_detail: parsed === "other" ? parsedDetail ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/onboarding");
}

/** Atualiza apenas name e slug do workspace. Não altera beta_program_id (evita perder reconhecimento de workspace beta). */
export async function updateWorkspaceName(workspaceId: string, name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = workspaceNameSchema.parse(name);
  const baseSlug = slugify(parsed);
  const slug = `${baseSlug}-${workspaceId.substring(0, 8)}`;

  const { error } = await supabase
    .from("workspaces")
    .update({ name: parsed, slug })
    .eq("id", workspaceId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  cookieStore.set("nf_onboard", user.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });

  const { data: betaParticipant } = await supabase
    .from("beta_participants")
    .select("workspace_id")
    .eq("user_id", user.id)
    .neq("status", "blocked")
    .limit(1)
    .maybeSingle();

  if (betaParticipant?.workspace_id) {
    cookieStore.set("workspace_id", betaParticipant.workspace_id, {
      path: "/",
      maxAge: 31536000,
      httpOnly: false,
      sameSite: "lax",
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function getProfileOnboardingStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, onboarding_intent, onboarding_intent_detail")
    .eq("id", user.id)
    .single();

  return data;
}
