"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPrivilegedAdminEmail } from "@/lib/admin-access";

const FREE_TRIAL_TRANSACTION_LIMIT = 3;

const schema = z.object({
  workspace_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).optional(),
  paid_by: z.string().uuid().nullable().optional(),
  split_type: z.enum(["single", "split_equal", "split_custom"]).optional(),
});

export async function createTransaction(formData: z.infer<typeof schema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = schema.parse(formData);
  const amountCents = Math.round(parsed.amount * 100);

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, stripe_subscription_id, beta_program_id")
    .eq("id", parsed.workspace_id)
    .maybeSingle();

  let isActiveBetaWorkspace = false;
  if (workspace?.beta_program_id) {
    const { data: program } = await supabase
      .from("beta_programs")
      .select("status, ends_at")
      .eq("id", workspace.beta_program_id)
      .maybeSingle();

    isActiveBetaWorkspace =
      !!program &&
      program.status === "active" &&
      new Date(program.ends_at) > new Date();
  }

  let hasOwnPaidWorkspace = false;
  try {
    const { data: ownedPaidWorkspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .not("stripe_subscription_id", "is", null)
      .limit(1);
    hasOwnPaidWorkspace = (ownedPaidWorkspace ?? []).length > 0;
  } catch {
    hasOwnPaidWorkspace = false;
  }

  let isUserInActiveBeta = false;
  try {
    const { data: betaRows } = await supabase
      .from("beta_participants")
      .select("beta_program_id")
      .eq("user_id", user.id)
      .neq("status", "blocked");
    const programIds = [...new Set((betaRows ?? []).map((row) => row.beta_program_id).filter(Boolean))];
    if (programIds.length > 0) {
      const { data: betaPrograms } = await supabase
        .from("beta_programs")
        .select("id, ends_at")
        .in("id", programIds)
        .eq("status", "active");
      isUserInActiveBeta = (betaPrograms ?? []).some((program) => new Date(program.ends_at) > new Date());
    }
  } catch {
    isUserInActiveBeta = false;
  }

  const hasPaidAccess =
    isPrivilegedAdminEmail(user.email) ||
    hasOwnPaidWorkspace ||
    !!workspace?.stripe_subscription_id ||
    isActiveBetaWorkspace ||
    isUserInActiveBeta;

  if (!hasPaidAccess) {
    const { count, error: countError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", parsed.workspace_id);

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= FREE_TRIAL_TRANSACTION_LIMIT) {
      throw new Error(
        "Você já criou 3 transações no período de teste. Assine o plano Pro para continuar."
      );
    }
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: parsed.workspace_id,
      category_id: parsed.category_id,
      type: parsed.type,
      amount: amountCents,
      description: parsed.description,
      date: parsed.date,
      notes: parsed.notes ?? null,
      tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : [],
      paid_by: parsed.paid_by ?? null,
      split_type: parsed.split_type ?? "single",
      created_by: user.id,
    })
    .select("*, category:categories(id, name, icon, type, color), paid_by_profile:profiles!paid_by(id, full_name)")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/reports");
  return data;
}

export async function updateTransaction(
  id: string,
  workspaceId: string,
  formData: z.infer<typeof schema>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = schema.parse(formData);
  const amountCents = Math.round(parsed.amount * 100);

  const { error } = await supabase
    .from("transactions")
    .update({
      category_id: parsed.category_id,
      type: parsed.type,
      amount: amountCents,
      description: parsed.description,
      date: parsed.date,
      notes: parsed.notes ?? null,
      tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : [],
      paid_by: parsed.paid_by ?? null,
      split_type: parsed.split_type ?? "single",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/reports");
}

export async function deleteTransaction(id: string, workspaceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/reports");
}

export async function getTransactionById(id: string, workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, workspace_id, category_id, type, amount, description, date, notes, tags, paid_by, split_type, paid_by_profile:profiles!paid_by(id, full_name)")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) return null;
  return data;
}

export const getMonthlyTransactions = cache(
  async (workspaceId: string, year: number, month: number) => {
    const supabase = await createClient();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("transactions")
      .select("*, category:categories(id, name, icon, type, color), paid_by_profile:profiles!paid_by(id, full_name)")
      .eq("workspace_id", workspaceId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }
);
