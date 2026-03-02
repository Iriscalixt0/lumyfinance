import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Convenience hook that returns the active workspace ID.
 * Pages can use this instead of manually querying workspace_members.
 */
export function useActiveWorkspaceId() {
  const { activeWorkspace, loading } = useWorkspace();
  return { workspaceId: activeWorkspace?.id ?? null, loading };
}
