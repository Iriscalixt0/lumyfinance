import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const DEV_BYPASS = import.meta.env.DEV && import.meta.env.MODE === "development";

const MOCK_WORKSPACE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Meu Workspace",
  slug: "meu-workspace",
  owner_id: "00000000-0000-0000-0000-000000000000",
};

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
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEV_BYPASS ? [MOCK_WORKSPACE] : []);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(DEV_BYPASS ? MOCK_WORKSPACE : null);
  const [loading, setLoading] = useState(!DEV_BYPASS);

  const load = useCallback(async () => {
    if (DEV_BYPASS) { setLoading(false); return; }
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
