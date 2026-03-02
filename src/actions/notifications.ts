"use server";

import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function getUnreadNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, workspace_id, type, title, body, data, read_at, created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as Notification[];
}

export async function getAllNotifications(limit = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, workspace_id, type, title, body, data, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Notification[];
}

export async function markNotificationAsRead(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllNotificationsAsRead(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  options?: { body?: string; workspaceId?: string; data?: Record<string, unknown> }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autorizado" };

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    workspace_id: options?.workspaceId ?? null,
    type,
    title,
    body: options?.body ?? null,
    data: options?.data ?? {},
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
