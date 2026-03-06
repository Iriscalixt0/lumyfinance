import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

interface PermissionsState {
  /** Whether the user can create/edit/delete data */
  canEdit: boolean;
  /** Human-readable reason why editing is blocked (empty if canEdit is true) */
  reason: string;
  /** The user's role in the active workspace */
  role: WorkspaceRole | null;
  /** Whether the workspace has an active paid plan, beta, or is within trial */
  hasPlan: boolean;
  /** Whether the user is a viewer (read-only role) */
  isViewer: boolean;
  /** Loading state */
  loading: boolean;
}

const TRIAL_DAYS = 7;
const FREE_TX_LIMIT = 3;

export function usePermissions(): PermissionsState {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [state, setState] = useState<PermissionsState>({
    canEdit: true,
    reason: "",
    role: null,
    hasPlan: true,
    isViewer: false,
    loading: true,
  });

  useEffect(() => {
    // Force Pro plan for all authenticated users
    if (user && activeWorkspace) {
      setState({
        canEdit: true,
        reason: "",
        role: "owner",
        hasPlan: true,
        isViewer: false,
        loading: false,
      });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [user, activeWorkspace]);

  return state;
}
