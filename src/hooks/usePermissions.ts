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
    async function check() {
      if (!user || !activeWorkspace) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }

      // Fetch role + workspace plan info in parallel
      const [memberRes, wsRes, txCountRes] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", activeWorkspace.id)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("workspaces")
          .select("stripe_subscription_id, beta_program_id, created_at")
          .eq("id", activeWorkspace.id)
          .single(),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", activeWorkspace.id),
      ]);

      const role = (memberRes.data?.role as WorkspaceRole) ?? null;
      const isViewer = role === "viewer";

      // Plan check: has stripe sub, beta, or within trial period
      const ws = wsRes.data;
      const hasStripe = !!ws?.stripe_subscription_id;
      const hasBeta = !!ws?.beta_program_id;
      const createdAt = ws?.created_at ? new Date(ws.created_at) : null;
      const withinTrial =
        createdAt !== null &&
        Date.now() - createdAt.getTime() < TRIAL_DAYS * 24 * 60 * 60 * 1000;
      const hasPlan = hasStripe || hasBeta || withinTrial;

      // Free users: limited to FREE_TX_LIMIT transactions
      const txCount = txCountRes.count ?? 0;
      const freeExceeded = !hasPlan && txCount >= FREE_TX_LIMIT;

      let canEdit = true;
      let reason = "";

      if (isViewer) {
        canEdit = false;
        reason = "Você tem permissão de visualização (viewer). Peça ao administrador para alterar seu papel.";
      } else if (!hasPlan && freeExceeded) {
        canEdit = false;
        reason = `Limite do plano gratuito atingido (${FREE_TX_LIMIT} transações). Assine o plano Pro para continuar.`;
      }

      setState({ canEdit, reason, role, hasPlan, isViewer, loading: false });
    }

    setState((s) => ({ ...s, loading: true }));
    check();
  }, [user, activeWorkspace]);

  return state;
}
