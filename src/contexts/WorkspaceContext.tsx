import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  switchWorkspace: (ws: Workspace) => void;
  reload: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  loading: true,
  switchWorkspace: () => {},
  reload: async () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id);

    if (!memberRows?.length) { setWorkspaces([]); setActiveWorkspace(null); setLoading(false); return; }

    const wsIds = memberRows.map((m) => m.workspace_id);
    const { data: wsList } = await supabase
      .from("workspaces")
      .select("id, name, slug, owner_id")
      .in("id", wsIds)
      .order("created_at");

    const list = wsList ?? [];
    setWorkspaces(list);

    // Restore last selected or pick first
    const savedId = localStorage.getItem("lmyf_active_ws");
    const saved = list.find((w) => w.id === savedId);
    setActiveWorkspace(saved ?? list[0] ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function switchWorkspace(ws: Workspace) {
    setActiveWorkspace(ws);
    localStorage.setItem("lmyf_active_ws", ws.id);
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, loading, switchWorkspace, reload: load }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
