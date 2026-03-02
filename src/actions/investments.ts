"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function createInvestment(formData: z.infer<typeof schema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = schema.parse(formData);
  const amountCents = Math.round(parsed.amount * 100);

  const { error } = await supabase.from("investments").insert({
    workspace_id: parsed.workspace_id,
    name: parsed.name,
    amount: amountCents,
    date: parsed.date,
    type: parsed.type ?? "outro",
    notes: parsed.notes ?? null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/investments");
  revalidatePath("/dashboard/reports");
}

export async function updateInvestment(
  id: string,
  workspaceId: string,
  formData: Omit<z.infer<typeof schema>, "workspace_id">
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const parsed = schema.parse({ ...formData, workspace_id: workspaceId });
  const amountCents = Math.round(parsed.amount * 100);

  const { error } = await supabase
    .from("investments")
    .update({
      name: parsed.name,
      amount: amountCents,
      date: parsed.date,
      type: parsed.type ?? "outro",
      notes: parsed.notes ?? null,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/investments");
  revalidatePath("/dashboard/reports");
}

export async function deleteInvestment(id: string, workspaceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/investments");
  revalidatePath("/dashboard/reports");
}

export async function getMonthlyInvestments(
  workspaceId: string,
  year: number,
  month: number
) {
  const supabase = await createClient();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getYearlyInvestments(workspaceId: string, year: number) {
  const supabase = await createClient();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInvestmentsByDateRange(
  workspaceId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
