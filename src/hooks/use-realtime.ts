"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTransactions(workspaceId: string | null, onUpdate: () => void) {
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`transactions:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, onUpdate]);
}
