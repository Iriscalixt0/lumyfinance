import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string; // budget_warning, receivable_overdue, goal_milestone, etc.
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

/** Map DB notification types to UI icon categories */
export function getNotifCategory(type: string): "warning" | "error" | "success" | "info" {
  if (type.includes("overdue") || type.includes("error")) return "error";
  if (type.includes("warning") || type.includes("budget")) return "warning";
  if (type.includes("milestone") || type.includes("completed") || type.includes("success")) return "success";
  return "info";
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    setNotifications(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markAsRead(id: string) {
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: now } : n));
  }

  async function markAllAsRead() {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  }

  async function dismiss(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, dismiss, reload: load };
}
