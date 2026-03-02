"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const supportRequestSchema = z.object({
  workspaceId: z.string().uuid().nullable().optional(),
  contactEmail: z.string().email(),
  subject: z.string().trim().min(3).max(160),
  category: z.enum(["bug", "billing", "feature", "account", "other"]),
  message: z.string().trim().min(10).max(4000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export type CreateSupportRequestInput = z.infer<typeof supportRequestSchema>;

export async function createSupportRequest(input: CreateSupportRequestInput) {
  const parsed = supportRequestSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Nao autorizado." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("support_requests")
    .insert({
      user_id: user.id,
      workspace_id: parsed.workspaceId ?? null,
      email: parsed.contactEmail,
      subject: parsed.subject,
      category: parsed.category,
      message: parsed.message,
      priority: parsed.priority,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false as const, error: insertError?.message ?? "Erro ao criar chamado." };
  }

  return {
    ok: true as const,
    protocol: inserted.id,
  };
}
