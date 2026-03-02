import { supabase } from "@/lib/supabase";

/**
 * Fire-and-forget call to check-alerts edge function.
 * Creates deduplicated notifications for budget/goal thresholds.
 */
export async function triggerAlertCheck(workspaceId: string) {
  try {
    await supabase.functions.invoke("check-alerts", {
      body: { workspace_id: workspaceId },
    });
  } catch {
    // silent – alert check is best-effort
  }
}
