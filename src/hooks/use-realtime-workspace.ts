"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UseRealtimeWorkspaceOptions {
  transactions?: boolean;
  goals?: boolean;
  investments?: boolean;
  members?: boolean;
}

export function useRealtimeWorkspace(
  workspaceId: string | null,
  options: UseRealtimeWorkspaceOptions,
  onUpdate: () => void
) {
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    const channelName = `workspace:${workspaceId}`;

    const channel = supabase.channel(channelName);

    if (options.transactions) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onUpdate
      );
    }

    if (options.goals) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onUpdate
      );
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goal_contributions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onUpdate
      );
    }

    if (options.investments) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "investments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onUpdate
      );
    }

    if (options.members) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        onUpdate
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, options.transactions, options.goals, options.investments, options.members, onUpdate]);
}
