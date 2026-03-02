"use server";

import { cache } from "react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBetaParticipationForWorkspace, isUserInActiveBeta } from "@/actions/beta";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";
import {
  syncInviteeMembershipRolesForPlan,
  userHasOwnProSubscription,
} from "@/lib/workspace-membership-access";
import { stripe } from "@/lib/stripe/config";

/** Pro: 2 workspaces. Sem assinatura: 1 (apenas o do onboarding). */
const MAX_WORKSPACES_WITH_SUBSCRIPTION = 2;
const MAX_WORKSPACES_WITHOUT_SUBSCRIPTION = 1;

type CategorySeed = { name: string; icon: string; type: "income" | "expense"; color: string };
type WorkspaceClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createSupabaseClient>;

const CATEGORY_NAMES_BY_LOCALE: Record<string, { income: string[]; expense: string[] }> = {
  en: {
    income: ["Salary", "Freelance", "Gift", "Other Income"],
    expense: ["Supermarket", "Housing", "Transport", "Health", "Leisure", "Shopping", "Other Expenses"],
  },
  es: {
    income: ["Salario", "Freelance", "Regalo", "Otros Ingresos"],
    expense: ["Supermercado", "Vivienda", "Transporte", "Salud", "Ocio", "Compras", "Otros Gastos"],
  },
};

const DEFAULT_CATEGORIES: CategorySeed[] = [
  { name: "Salário", icon: "wallet", type: "income", color: "#10b981" },
  { name: "Freelance", icon: "briefcase", type: "income", color: "#06b6d4" },
  { name: "Presente", icon: "gift", type: "income", color: "#f59e0b" },
  { name: "Outros Recebimentos", icon: "inbox", type: "income", color: "#8b5cf6" },
  { name: "Supermercado", icon: "shopping-cart", type: "expense", color: "#ef4444" },
  { name: "Moradia", icon: "home", type: "expense", color: "#f97316" },
  { name: "Transporte", icon: "car", type: "expense", color: "#eab308" },
  { name: "Saúde", icon: "heart-pulse", type: "expense", color: "#22c55e" },
  { name: "Lazer", icon: "gamepad-2", type: "expense", color: "#3b82f6" },
  { name: "Compras", icon: "shopping-bag", type: "expense", color: "#a855f7" },
  { name: "Outros Gastos", icon: "box", type: "expense", color: "#64748b" },
];

function getDefaultCategories(locale?: string): CategorySeed[] {
  const lang = locale ? locale.split("-")[0] : "pt";
  const names = CATEGORY_NAMES_BY_LOCALE[lang];
  if (!names) return DEFAULT_CATEGORIES;
  return [
    { name: names.income[0], icon: "wallet", type: "income", color: "#10b981" },
    { name: names.income[1], icon: "briefcase", type: "income", color: "#06b6d4" },
    { name: names.income[2], icon: "gift", type: "income", color: "#f59e0b" },
    { name: names.income[3], icon: "inbox", type: "income", color: "#8b5cf6" },
    { name: names.expense[0], icon: "shopping-cart", type: "expense", color: "#ef4444" },
    { name: names.expense[1], icon: "home", type: "expense", color: "#f97316" },
    { name: names.expense[2], icon: "car", type: "expense", color: "#eab308" },
    { name: names.expense[3], icon: "heart-pulse", type: "expense", color: "#22c55e" },
    { name: names.expense[4], icon: "gamepad-2", type: "expense", color: "#3b82f6" },
    { name: names.expense[5], icon: "shopping-bag", type: "expense", color: "#a855f7" },
    { name: names.expense[6], icon: "box", type: "expense", color: "#64748b" },
  ];
}

const WORKSPACE_NAME_BY_LOCALE: Record<string, string> = {
  en: "My Finances",
  es: "Mis Finanzas",
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function promoteVisitorToFullIfNeeded(userId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  await admin
    .from("profiles")
    .update({ user_type: "full", updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("user_type", "visitor");
}

async function getUserWorkspaceCount(userId: string): Promise<number | null> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  if (!error && typeof count === "number") return count;

  const admin = getAdminClient();
  if (!admin) return null;

  const { count: adminCount, error: adminError } = await admin
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  if (adminError || typeof adminCount !== "number") return null;
  return adminCount;
}

async function ensureWorkspaceWithAdmin(user: { id: string; user_metadata?: Record<string, unknown> }, locale?: string) {
  const admin = getAdminClient();
  if (!admin) return false;

  const { data: existingMember } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (existingMember?.workspace_id) return true;

  await admin.from("profiles").upsert(
    {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? "Usuario",
      avatar_url: user.user_metadata?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const lang = locale ? locale.split("-")[0] : "pt";
  const wsName = WORKSPACE_NAME_BY_LOCALE[lang] ?? "Minhas Finanças";
  const slug = `personal-${user.id.replace(/-/g, "").slice(0, 32)}`;
  const { data: ws } = await admin
    .from("workspaces")
    .insert({ name: wsName, slug, owner_id: user.id })
    .select("id")
    .single();

  if (!ws?.id) return false;

  await admin.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
    granted_role: "owner",
    accepted_at: new Date().toISOString(),
  });

  for (const c of getDefaultCategories(locale)) {
    await admin.from("categories").insert({
      workspace_id: ws.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
      color: c.color,
      is_system: true,
    });
  }

  return true;
}

/** Cria workspace para visitante assinar Pro. Se já tiver workspace próprio sem assinatura, reutiliza. */
export async function createWorkspaceForVisitorUpgrade(locale?: string): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado." };

  const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
  if ((profile as { user_type?: string } | null)?.user_type !== "visitor") {
    return { ok: false, error: "Apenas visitantes podem usar este fluxo." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Erro de configuracao." };

  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .is("stripe_subscription_id", null)
    .limit(1)
    .maybeSingle();

  if (owned?.id) return { ok: true, workspaceId: owned.id };

  const lang = locale ? locale.split("-")[0] : "pt";
  const wsName = WORKSPACE_NAME_BY_LOCALE[lang] ?? "Minhas Finanças";
  const slug = `upgrade-${user.id.replace(/-/g, "").slice(0, 24)}-${Date.now().toString(36).slice(-6)}`;
  const { data: ws, error } = await admin
    .from("workspaces")
    .insert({ name: wsName, slug, plan: "pro", owner_id: user.id })
    .select("id")
    .single();

  if (error || !ws?.id) return { ok: false, error: error?.message ?? "Erro ao criar workspace." };

  await admin.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
    granted_role: "owner",
    accepted_at: new Date().toISOString(),
  });

  for (const c of getDefaultCategories(locale)) {
    await admin.from("categories").insert({
      workspace_id: ws.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
      color: c.color,
      is_system: true,
    });
  }

  revalidatePath("/dashboard");
  return { ok: true, workspaceId: ws.id };
}

export async function ensureDefaultWorkspace(locale?: string): Promise<boolean> {
  const user = await getCachedUser();
  if (!user) return false;
  const supabase = await createClient();

  // Visitantes não criam workspace próprio; só acessam via convite
  const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
  if ((profile as { user_type?: string } | null)?.user_type === "visitor") {
    return true;
  }

  // Tenta RPC primeiro (quando migration foi aplicada)
  const { data: rpcData, error: rpcError } = await supabase.rpc("ensure_user_workspace");
  if (!rpcError && rpcData) return true;

  // Fallback: cria workspace diretamente (com políticas RLS)
  // Garante que o profile existe (trigger pode não ter rodado)
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? "Usuário",
      avatar_url: user.user_metadata?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const lang = locale ? locale.split("-")[0] : "pt";
  const wsName = WORKSPACE_NAME_BY_LOCALE[lang] ?? "Minhas Finanças";
  const slug = `personal-${user.id.replace(/-/g, "").slice(0, 32)}`;
  const { data: ws, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name: wsName, slug, owner_id: user.id })
    .select("id")
    .single();

  if (wsError || !ws) {
    return ensureWorkspaceWithAdmin(user, locale);
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: "owner",
      granted_role: "owner",
      accepted_at: new Date().toISOString(),
    });

  if (memberError) {
    return ensureWorkspaceWithAdmin(user, locale);
  }

  for (const c of getDefaultCategories(locale)) {
    await supabase.from("categories").insert({
      workspace_id: ws.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
      color: c.color,
      is_system: true,
    });
  }

  return true;
}

export async function hasUserWorkspace(): Promise<boolean> {
  const workspaces = await getWorkspacesForUser();
  return workspaces.length > 0;
}

export async function getWorkspacesForUser() {
  const user = await getCachedUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null);

  let ids = members?.map((m) => m.workspace_id) ?? [];
  if (!ids.length) {
    const admin = getAdminClient();
    if (!admin) return [];

    const { data: adminMembers } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null);

    ids = adminMembers?.map((m) => m.workspace_id) ?? [];
    if (!ids.length) return [];
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: true });

  if (workspaces?.length) return workspaces;

  const admin = getAdminClient();
  if (!admin) return [];
  const { data: adminWorkspaces } = await admin
    .from("workspaces")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: true });

  return adminWorkspaces ?? [];
}

export async function getWorkspaceById(workspaceId: string | null) {
  if (!workspaceId) return null;
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (data) return data;

  const admin = getAdminClient();
  if (!admin) return null;

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  const { data: adminWorkspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  return adminWorkspace ?? null;
}

export const getResolvedWorkspaceContext = cache(async (workspaceCookieId: string | null) => {
  let workspaces = await getWorkspacesForUser();
  if (workspaces.length === 0) {
    await ensureDefaultWorkspace();
    workspaces = await getWorkspacesForUser();
  }

  const firstWorkspaceId = workspaces[0]?.id ?? null;
  const preferredWorkspaceId = workspaceCookieId ?? firstWorkspaceId;

  const workspaceFromPreferred = await getWorkspaceById(preferredWorkspaceId);
  const workspace =
    workspaceFromPreferred ??
    (firstWorkspaceId && firstWorkspaceId !== preferredWorkspaceId
      ? await getWorkspaceById(firstWorkspaceId)
      : null);

  const participation = await getBetaParticipationForWorkspace(workspace?.id ?? null);
  return { workspaces, workspace, participation };
});

export async function getIsVisitor(): Promise<boolean> {
  const user = await getCachedUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
  const isVisitorProfile = (profile as { user_type?: string } | null)?.user_type === "visitor";
  if (!isVisitorProfile) return false;

  const hasOwnPlan = await getUserHasOwnProPlan();
  if (hasOwnPlan) {
    await promoteVisitorToFullIfNeeded(user.id);
    return false;
  }

  return true;
}

export async function getUserHasOwnProPlan(): Promise<boolean> {
  const user = await getCachedUser();
  if (!user) return false;

  const supabase = await createClient();
  const hasOwnSubscription = await userHasOwnProSubscription(
    supabase,
    user.id,
    user.email
  );
  if (hasOwnSubscription) {
    const admin = getAdminClient();
    if (admin) {
      await admin
        .from("profiles")
        .update({ user_type: "full", updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .eq("user_type", "visitor");
      await syncInviteeMembershipRolesForPlan(admin, user.id, true);
    }
    return true;
  }

  const admin = getAdminClient();
  if (!admin) return false;
  const hasOwnSubscriptionFromAdmin = await userHasOwnProSubscription(admin, user.id, user.email);
  if (hasOwnSubscriptionFromAdmin) {
    await admin
      .from("profiles")
      .update({ user_type: "full", updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .eq("user_type", "visitor");
    await syncInviteeMembershipRolesForPlan(admin, user.id, true);
  }
  return hasOwnSubscriptionFromAdmin;
}

const createWorkspaceSchema = z
  .string()
  .trim()
  .min(2, "Nome precisa ter ao menos 2 caracteres.")
  .max(60, "Nome muito longo.");

function slugifyWorkspaceName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type CreateWorkspaceResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

async function createWorkspaceWithClient(
  client: WorkspaceClient,
  user: { id: string; user_metadata?: Record<string, unknown> },
  workspaceName: string,
  locale?: string
): Promise<CreateWorkspaceResult> {
  await client.from("profiles").upsert(
    {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? "Usuario",
      avatar_url: user.user_metadata?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const slugBase = slugifyWorkspaceName(workspaceName) || "workspace";
  const slug = `${slugBase}-${Date.now().toString(36).slice(-6)}-${user.id.replace(/-/g, "").slice(0, 6)}`;
  const { data: ws, error: wsError } = await client
    .from("workspaces")
    .insert({ name: workspaceName, slug, plan: "pro", owner_id: user.id })
    .select("id")
    .single();

  if (wsError || !ws?.id) {
    return { ok: false, error: wsError?.message ?? "Nao foi possivel criar o workspace." };
  }

  const { error: memberError } = await client.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
    granted_role: "owner",
    accepted_at: new Date().toISOString(),
  });

  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  for (const c of getDefaultCategories(locale)) {
    await client.from("categories").insert({
      workspace_id: ws.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
      color: c.color,
      is_system: true,
    });
  }

  return { ok: true, workspaceId: ws.id };
}

export async function createWorkspace(name: string): Promise<CreateWorkspaceResult> {
  const parsed = createWorkspaceSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Dados invalidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado." };

  const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
  if ((profile as { user_type?: string } | null)?.user_type === "visitor") {
    const hasOwnPlan = await getUserHasOwnProPlan();
    if (!hasOwnPlan) {
      return { ok: false, error: "Visitantes nao podem criar workspace. Assine o plano Pro para ter seu proprio espaco." };
    }
    await promoteVisitorToFullIfNeeded(user.id);
  }

  const workspaces = await getWorkspacesForUser();
  const inActiveBeta = await isUserInActiveBeta();
  const hasSubscription =
    isPrivilegedAdminEmail(user.email) ||
    workspaces.some((ws) => !!ws.stripe_subscription_id) ||
    inActiveBeta;
  const maxWorkspaces = hasSubscription
    ? MAX_WORKSPACES_WITH_SUBSCRIPTION
    : MAX_WORKSPACES_WITHOUT_SUBSCRIPTION;

  const userWorkspaceCount = await getUserWorkspaceCount(user.id);
  if (userWorkspaceCount === null) {
    return { ok: false, error: "Nao foi possivel validar o limite do plano." };
  }

  if (userWorkspaceCount >= maxWorkspaces) {
    return {
      ok: false,
      error: hasSubscription
        ? `O plano Pro permite ate ${MAX_WORKSPACES_WITH_SUBSCRIPTION} workspaces.`
        : "Assine o Pro para criar mais workspaces.",
    };
  }

  let result = await createWorkspaceWithClient(supabase, user, parsed.data);
  if (!result.ok) {
    const admin = getAdminClient();
    if (!admin) return result;
    result = await createWorkspaceWithClient(admin, user, parsed.data);
    if (!result.ok) return result;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/settings");
  revalidatePath("/pt-BR/dashboard");
  revalidatePath("/pt-BR/dashboard/workspace");
  revalidatePath("/pt-BR/dashboard/settings");
  revalidatePath("/pt-PT/dashboard");
  revalidatePath("/pt-PT/dashboard/workspace");
  revalidatePath("/pt-PT/dashboard/settings");
  revalidatePath("/en/dashboard");
  revalidatePath("/en/dashboard/workspace");
  revalidatePath("/en/dashboard/settings");
  revalidatePath("/es/dashboard");
  revalidatePath("/es/dashboard/workspace");
  revalidatePath("/es/dashboard/settings");

  return result;
}

const updateWorkspaceSchema = z
  .string()
  .trim()
  .min(2, "Nome precisa ter ao menos 2 caracteres.")
  .max(60, "Nome muito longo.");

export type UpdateWorkspaceResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateWorkspaceName(
  workspaceId: string,
  name: string
): Promise<UpdateWorkspaceResult> {
  const parsedName = updateWorkspaceSchema.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.errors[0]?.message ?? "Dados invalidos." };
  }

  const parsedWorkspaceId = z.string().uuid().safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    return { ok: false, error: "Workspace invalido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado." };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id")
    .eq("id", parsedWorkspaceId.data)
    .single();

  if (!workspace || workspace.owner_id !== user.id) {
    return { ok: false, error: "Apenas o dono pode editar este workspace." };
  }

  let updateError: string | null = null;

  const { error } = await supabase
    .from("workspaces")
    .update({ name: parsedName.data })
    .eq("id", parsedWorkspaceId.data);
  updateError = error?.message ?? null;

  if (updateError) {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: updateError };
    const { error: adminError } = await admin
      .from("workspaces")
      .update({ name: parsedName.data })
      .eq("id", parsedWorkspaceId.data)
      .eq("owner_id", user.id);
    if (adminError) return { ok: false, error: adminError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/settings");
  revalidatePath("/pt-BR/dashboard");
  revalidatePath("/pt-BR/dashboard/workspace");
  revalidatePath("/pt-BR/dashboard/settings");
  revalidatePath("/pt-PT/dashboard");
  revalidatePath("/pt-PT/dashboard/workspace");
  revalidatePath("/pt-PT/dashboard/settings");
  revalidatePath("/en/dashboard");
  revalidatePath("/en/dashboard/workspace");
  revalidatePath("/en/dashboard/settings");
  revalidatePath("/es/dashboard");
  revalidatePath("/es/dashboard/workspace");
  revalidatePath("/es/dashboard/settings");
  return { ok: true };
}

export type DeleteWorkspaceResult =
  | { ok: true; nextWorkspaceId: string | null }
  | { ok: false; error: string };

export type LeaveWorkspaceResult =
  | { ok: true; nextWorkspaceId: string | null }
  | { ok: false; error: string };

export async function leaveWorkspace(workspaceId: string): Promise<LeaveWorkspaceResult> {
  const parsedWorkspaceId = z.string().uuid().safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    return { ok: false, error: "Workspace invalido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado." };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", parsedWorkspaceId.data)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (!membership) {
    return { ok: false, error: "Voce nao participa deste workspace." };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", parsedWorkspaceId.data)
    .maybeSingle();

  if (workspace?.owner_id === user.id || membership.role === "owner") {
    return { ok: false, error: "O dono nao pode sair do proprio workspace." };
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null);

  const nextWorkspaceId =
    (memberships ?? []).find((m) => m.workspace_id !== parsedWorkspaceId.data)?.workspace_id ?? null;

  const { data: deletedRows, error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", parsedWorkspaceId.data)
    .eq("user_id", user.id)
    .select("id");
  const deletedByUserClient = (deletedRows?.length ?? 0) > 0;

  if (!deletedByUserClient) {
    const admin = getAdminClient();
    if (!admin) {
      return {
        ok: false,
        error: deleteError?.message ?? "Nao foi possivel sair do workspace.",
      };
    }

    const { data: adminDeletedRows, error: adminDeleteError } = await admin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", parsedWorkspaceId.data)
      .eq("user_id", user.id)
      .select("id");

    if ((adminDeletedRows?.length ?? 0) === 0) {
      return {
        ok: false,
        error: adminDeleteError?.message ?? "Nao foi possivel sair do workspace.",
      };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/settings");
  revalidatePath("/pt-BR/dashboard");
  revalidatePath("/pt-BR/dashboard/workspace");
  revalidatePath("/pt-BR/dashboard/settings");
  revalidatePath("/pt-PT/dashboard");
  revalidatePath("/pt-PT/dashboard/workspace");
  revalidatePath("/pt-PT/dashboard/settings");
  revalidatePath("/en/dashboard");
  revalidatePath("/en/dashboard/workspace");
  revalidatePath("/en/dashboard/settings");
  revalidatePath("/es/dashboard");
  revalidatePath("/es/dashboard/workspace");
  revalidatePath("/es/dashboard/settings");

  return { ok: true, nextWorkspaceId };
}

export async function deleteWorkspace(workspaceId: string): Promise<DeleteWorkspaceResult> {
  const parsedWorkspaceId = z.string().uuid().safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    return { ok: false, error: "Workspace invalido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado." };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id, stripe_subscription_id, stripe_customer_id")
    .eq("id", parsedWorkspaceId.data)
    .single();
  if (!workspace || workspace.owner_id !== user.id) {
    return { ok: false, error: "Apenas o dono pode excluir este workspace." };
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null);

  const totalWorkspaces = (memberships ?? []).length;
  if (totalWorkspaces <= 1) {
    return {
      ok: false,
      error:
        "Você não pode excluir o único workspace. Seu plano ficaria inativo. Crie outro workspace antes de excluir este.",
    };
  }

  // Escolher outro workspace de que o usuário seja dono (para transferir a assinatura, se houver)
  const { data: otherOwned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .neq("id", parsedWorkspaceId.data)
    .limit(1)
    .maybeSingle();
  const nextWorkspaceId = otherOwned?.id ?? null;

  if (workspace.stripe_subscription_id && !nextWorkspaceId) {
    return {
      ok: false,
      error:
        "Você não pode excluir este workspace porque ele tem sua assinatura Pro. Crie outro workspace (do qual você seja dono) e exclua este em seguida para transferir o plano.",
    };
  }

  // Destino para trocar de workspace após exclusão (qualquer um em que seja membro)
  const fallbackWorkspaceId =
    (memberships ?? []).find((m) => m.workspace_id !== parsedWorkspaceId.data)?.workspace_id ?? null;

  // Se o workspace excluído tem assinatura Pro, transferir para outro workspace próprio para o usuário não perder o plano
  if (workspace.stripe_subscription_id && nextWorkspaceId) {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Erro interno. Tente novamente." };

    if (stripe) {
      try {
        await stripe.subscriptions.update(workspace.stripe_subscription_id, {
          metadata: { workspace_id: nextWorkspaceId, plan: "pro" },
        });
      } catch (stripeErr) {
        const msg = stripeErr instanceof Error ? stripeErr.message : "Erro ao atualizar assinatura.";
        return { ok: false, error: `Não foi possível transferir a assinatura: ${msg}` };
      }
    }
    // Limpar primeiro o workspace que será excluído para não violar UNIQUE (stripe_customer_id)
    const { error: clearErr } = await admin
      .from("workspaces")
      .update({
        stripe_subscription_id: null,
        stripe_customer_id: null,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", parsedWorkspaceId.data)
      .eq("owner_id", user.id);
    if (clearErr) return { ok: false, error: clearErr.message };

    const { error: updateErr } = await admin
      .from("workspaces")
      .update({
        stripe_subscription_id: workspace.stripe_subscription_id,
        stripe_customer_id: workspace.stripe_customer_id ?? null,
        plan: "pro",
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", nextWorkspaceId)
      .eq("owner_id", user.id);
    if (updateErr) return { ok: false, error: updateErr.message };
    await syncInviteeMembershipRolesForPlan(admin, user.id, true);
  }

  const admin = getAdminClient();
  if (admin) {
    const { error } = await admin
      .from("workspaces")
      .delete()
      .eq("id", parsedWorkspaceId.data)
      .eq("owner_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", parsedWorkspaceId.data)
      .eq("owner_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/settings");
  revalidatePath("/pt-BR/dashboard");
  revalidatePath("/pt-BR/dashboard/workspace");
  revalidatePath("/pt-BR/dashboard/settings");
  revalidatePath("/pt-PT/dashboard");
  revalidatePath("/pt-PT/dashboard/workspace");
  revalidatePath("/pt-PT/dashboard/settings");
  revalidatePath("/en/dashboard");
  revalidatePath("/en/dashboard/workspace");
  revalidatePath("/en/dashboard/settings");
  revalidatePath("/es/dashboard");
  revalidatePath("/es/dashboard/workspace");
  revalidatePath("/es/dashboard/settings");

  return { ok: true, nextWorkspaceId: nextWorkspaceId ?? fallbackWorkspaceId };
}
