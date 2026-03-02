"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useRealtimeWorkspace } from "@/hooks/use-realtime-workspace";
import type { UseRealtimeWorkspaceOptions } from "@/hooks/use-realtime-workspace";

interface RealtimeRefresherProps {
  workspaceId: string | null;
  options: UseRealtimeWorkspaceOptions;
}

/**
 * Client component that subscribes to workspace changes and triggers
 * router.refresh() when data is updated (e.g. by another member).
 * Place this in dashboard pages that display transactions, goals, or investments.
 */
export function RealtimeRefresher({ workspaceId, options }: RealtimeRefresherProps) {
  const router = useRouter();
  const handleUpdate = useCallback(() => {
    router.refresh();
  }, [router]);

  useRealtimeWorkspace(workspaceId, options, handleUpdate);
  return null;
}
