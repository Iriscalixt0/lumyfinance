"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, Loader2, X } from "lucide-react";
import type { Workspace } from "@/types/database";
import { createWorkspace } from "@/actions/workspaces";

export function SettingsClient({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [optimisticWorkspaceId, setOptimisticWorkspaceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function setWorkspace(workspaceId: string) {
    const previousWorkspaceId = optimisticWorkspaceId ?? currentWorkspaceId;
    setOptimisticWorkspaceId(workspaceId);
    const response = await fetch("/api/set-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    if (!response.ok) {
      setOptimisticWorkspaceId(previousWorkspaceId);
      throw new Error(await response.text());
    }
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    const result = await createWorkspace(newWorkspaceName);
    if (!result.ok) {
      setCreateError(result.error);
      setCreateLoading(false);
      return;
    }

    try {
      await setWorkspace(result.workspaceId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Erro ao trocar workspace.");
      setCreateLoading(false);
      return;
    }
    setNewWorkspaceName("");
    setCreating(false);
    setCreateLoading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreating((v) => !v);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/40 transition-colors"
        >
          {creating ? <X size={14} /> : <Plus size={14} />}
          {creating ? "Fechar" : "Novo workspace"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreateWorkspace}
          className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nome do workspace
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Ex: Empresa, Casa, Projetos"
              required
              minLength={2}
              maxLength={60}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-70 inline-flex items-center justify-center gap-2"
            >
              {createLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar"
              )}
            </button>
          </div>
          {createError && <p className="text-sm text-rose-600">{createError}</p>}
        </form>
      )}

      {workspaces.map((w) => {
        const isActive = (optimisticWorkspaceId ?? currentWorkspaceId) === w.id;
        return (
          <div
            key={w.id}
            role="button"
            tabIndex={0}
            onClick={() => !isPending && setWorkspace(w.id)}
            onKeyDown={(e) => e.key === "Enter" && !isPending && setWorkspace(w.id)}
            className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${
              isActive
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground/30 bg-secondary/30"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 border-card shadow-sm flex-shrink-0 ${
                  isActive ? "bg-primary ring-2 ring-primary/20" : "bg-muted-foreground/40"
                }`}
              />
              <div>
                <span className="font-bold text-foreground block sm:inline">
                  {w.name}
                </span>
                <span className="text-xs text-muted-foreground font-normal sm:ml-2">
                  ({w.plan})
                </span>
              </div>
            </div>
            <ShieldCheck
              size={20}
              className={isActive ? "text-primary" : "text-muted-foreground/40"}
            />
          </div>
        );
      })}
      {workspaces.length === 0 && (
        <p className="text-muted-foreground italic">Nenhum workspace.</p>
      )}
    </div>
  );
}
