"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({
  workspace_id: z.string().uuid(),
  debtor_name: z.string().min(1, "Nome e obrigatorio").max(200),
  amount: z.number().positive("Valor deve ser positivo"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(["pending", "paid", "overdue"]).optional(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type ReceivableInsert = z.infer<typeof createSchema>;

export async function createReceivable(formData: z.infer<typeof createSchema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");

  const parsed = createSchema.parse(formData);
  const amountCents = Math.round(parsed.amount * 100);

  const { error } = await supabase.from("receivables").insert({
    workspace_id: parsed.workspace_id,
    debtor_name: parsed.debtor_name,
    amount: amountCents,
    due_date: parsed.due_date ?? null,
    status: parsed.status ?? "pending",
    phone: parsed.phone ?? null,
    notes: parsed.notes ?? null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cobrancas");
}

export async function updateReceivable(
  id: string,
  workspaceId: string,
  formData: Omit<z.infer<typeof createSchema>, "workspace_id">
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");

  const parsed = createSchema.parse({ ...formData, workspace_id: workspaceId });
  const amountCents = Math.round(parsed.amount * 100);

  const { error } = await supabase
    .from("receivables")
    .update({
      debtor_name: parsed.debtor_name,
      amount: amountCents,
      due_date: parsed.due_date ?? null,
      status: parsed.status ?? "pending",
      phone: parsed.phone ?? null,
      notes: parsed.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cobrancas");
}

export async function deleteReceivable(id: string, workspaceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("receivables")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cobrancas");
}

export async function markReceivableAsPaid(id: string, workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");
  const { error } = await supabase
    .from("receivables")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cobrancas");
}

export type ReceivableRow = {
  id: string;
  workspace_id: string;
  debtor_name: string;
  amount: number;
  due_date: string | null;
  status: "pending" | "paid" | "overdue";
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type ReceivablesFilter = {
  status?: "pending" | "paid" | "overdue";
  fromDate?: string;
  toDate?: string;
  debtorName?: string;
};

export async function getReceivables(
  workspaceId: string,
  filter?: ReceivablesFilter
): Promise<ReceivableRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("receivables")
    .select("id, workspace_id, debtor_name, amount, due_date, status, phone, notes, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.fromDate) query = query.gte("due_date", filter.fromDate);
  if (filter?.toDate) query = query.lte("due_date", filter.toDate);
  if (filter?.debtorName?.trim()) {
    query = query.ilike("debtor_name", `%${filter.debtorName.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReceivableRow[];
}

export async function getReceivableById(id: string, workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receivables")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) return null;
  return data as ReceivableRow;
}

