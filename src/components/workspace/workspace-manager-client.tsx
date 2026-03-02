"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  Check,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Share2,
  User,
  LogOut,
  X,
} from "lucide-react";
import type { Workspace, WorkspaceInvite } from "@/types/database";
import type { WorkspaceMemberWithProfile } from "@/actions/invites";
import {
  createWorkspace,
  leaveWorkspace,
  deleteWorkspace,
  updateWorkspaceName,
} from "@/actions/workspaces";
import { WorkspaceMembersClient } from "@/components/settings/workspace-members-client";
import { ProfileTab } from "@/components/workspace/profile-tab";
import { useRealtimeWorkspace } from "@/hooks/use-realtime-workspace";

export type WorkspaceListItem = Workspace & {
  membership_role?: "owner" | "admin" | "editor" | "viewer" | null;
  invited_by_name?: string | null;
};

export function WorkspaceManagerClient({
  userId,
  userEmail,
  userFullName,
  workspaces,
  currentWorkspaceId,
  workspaceMembers,
  workspaceInvites,
  canManageMembers,
}: {
  userId: string | null;
  userEmail: string;
  userFullName: string;
  workspaces: WorkspaceListItem[];
  currentWorkspaceId: string | null;
  workspaceMembers: WorkspaceMemberWithProfile[];
  workspaceInvites: WorkspaceInvite[];
  canManageMembers: boolean;
}) {
  type Toast = {
    id: number;
    message: string;
    kind: "success" | "error";
  };

  const router = useRouter();
  const [optimisticWorkspaceId, setOptimisticWorkspaceId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [leavingWorkspaceId, setLeavingWorkspaceId] = useState<string | null>(null);
  const [workspaceToLeave, setWorkspaceToLeave] = useState<WorkspaceListItem | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"workspaces" | "members" | "share" | "perfil">("workspaces");
  const t = useTranslations("workspace");

  // Realtime: atualiza automaticamente quando membros mudam
  const handleRealtimeUpdate = useCallback(() => {
    router.refresh();
  }, [router]);
  useRealtimeWorkspace(currentWorkspaceId, { members: true }, handleRealtimeUpdate);

  const roleLabelById: Record<"owner" | "admin" | "editor" | "viewer", string> = {
    owner: t("roleOwner"),
    admin: t("roleAdmin"),
    editor: t("roleEditor"),
    viewer: t("roleViewer"),
  };

  const activeWorkspaceId = optimisticWorkspaceId ?? currentWorkspaceId;
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const addToast = useCallback((message: string, kind: Toast["kind"]) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

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

    startTransition(() => router.refresh());
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setLoadingCreate(true);

    const result = await createWorkspace(newWorkspaceName);
    if (!result.ok) {
      setActionError(result.error);
      addToast(result.error, "error");
      setLoadingCreate(false);
      return;
    }

    try {
      await setWorkspace(result.workspaceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errorSwitchWorkspace");
      setActionError(message);
      addToast(message, "error");
      setLoadingCreate(false);
      return;
    }

    setNewWorkspaceName("");
    setCreating(false);
    setLoadingCreate(false);
    addToast(t("createdSuccess"), "success");
  }

  async function handleSaveName(workspaceId: string) {
    setActionError(null);
    const result = await updateWorkspaceName(workspaceId, editName);
    if (!result.ok) {
      setActionError(result.error);
      addToast(result.error, "error");
      return;
    }
    setEditingWorkspaceId(null);
    setEditName("");
    addToast(t("nameUpdated"), "success");
    startTransition(() => router.refresh());
  }

  async function handleDeleteWorkspace(workspace: Workspace) {
    setActionError(null);
    setDeletingWorkspaceId(workspace.id);

    const result = await deleteWorkspace(workspace.id);
    if (!result.ok) {
      setActionError(result.error);
      addToast(result.error, "error");
      setDeletingWorkspaceId(null);
      return;
    }

    if (result.nextWorkspaceId) {
      try {
        await setWorkspace(result.nextWorkspaceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("errorSwitchWorkspace");
        setActionError(message);
        addToast(message, "error");
      }
    } else {
      startTransition(() => router.refresh());
    }

    setDeletingWorkspaceId(null);
    setWorkspaceToDelete(null);
    addToast(t("deleteSuccess", { name: workspace.name }), "success");
  }

  async function handleLeaveWorkspace(workspace: WorkspaceListItem) {
    setActionError(null);
    setLeavingWorkspaceId(workspace.id);

    const result = await leaveWorkspace(workspace.id);
    if (!result.ok) {
      setActionError(result.error);
      addToast(result.error, "error");
      setLeavingWorkspaceId(null);
      return;
    }

    const isLeavingActive = activeWorkspaceId === workspace.id;
    if (isLeavingActive && result.nextWorkspaceId) {
      try {
        await setWorkspace(result.nextWorkspaceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("errorSwitchWorkspace");
        setActionError(message);
        addToast(message, "error");
      }
    } else {
      startTransition(() => router.refresh());
    }

    setLeavingWorkspaceId(null);
    setWorkspaceToLeave(null);
    addToast(t("leaveSuccess", { name: workspace.name }), "success");
  }

  const tabs = [
    { id: "workspaces" as const, label: t("tabWorkspaces"), icon: Briefcase },
    { id: "members" as const, label: t("tabMembers"), icon: Users },
    { id: "share" as const, label: t("tabShare"), icon: Share2 },
    { id: "perfil" as const, label: t("tabProfile"), icon: User },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-0 pb-12">
      <header className="mb-2">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {t("subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1 p-1 rounded-xl bg-secondary/50 border border-border sm:overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={16} className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "workspaces" && (
      <section className="bg-card rounded-xl sm:rounded-2xl shadow-card border border-border p-4 sm:p-8 transition-colors">
        <div className="flex items-start sm:items-center gap-3 mb-4">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Briefcase size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-bold text-foreground">{t("sectionTitle")}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("sectionSubtitle")}</p>
          </div>
        </div>

        <div className="flex justify-stretch sm:justify-end mb-4">
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setCreating((value) => !value);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/40 transition-colors min-h-[44px] sm:min-h-0"
          >
            {creating ? <X size={14} /> : <Plus size={14} />}
            {creating ? t("closeButton") : t("newWorkspace")}
          </button>
        </div>

        {creating && (
          <form
            onSubmit={handleCreateWorkspace}
            className="mb-4 p-4 rounded-xl border border-border bg-secondary/20 space-y-3"
          >
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("workspaceNameLabel")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={t("workspaceNamePlaceholder")}
                required
                minLength={2}
                maxLength={60}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              <button
                type="submit"
                disabled={loadingCreate}
                className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-70 inline-flex items-center justify-center gap-2"
              >
                {loadingCreate ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  t("create")
                )}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {workspaces.map((workspace) => {
            const isActive = activeWorkspaceId === workspace.id;
            const membershipRole: "owner" | "admin" | "editor" | "viewer" =
              workspace.membership_role ?? (workspace.owner_id === userId ? "owner" : "viewer");
            const isOwner = membershipRole === "owner" || workspace.owner_id === userId;
            const isEditing = editingWorkspaceId === workspace.id;
            const isDeleting = deletingWorkspaceId === workspace.id;
            const isLeaving = leavingWorkspaceId === workspace.id;
            const roleLabel = roleLabelById[membershipRole];
            const invitedByName = workspace.invited_by_name?.trim();

            return (
              <div
                key={workspace.id}
                className={`p-4 sm:p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => !isPending && !isDeleting && !isLeaving && setWorkspace(workspace.id)}
                    disabled={isPending || isDeleting || isLeaving}
                    className="text-left flex items-center gap-3 sm:gap-4 disabled:opacity-70 min-h-[44px] sm:min-h-0 w-full"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 border-card shadow-sm shrink-0 ${
                        isActive ? "bg-primary ring-2 ring-primary/20" : "bg-muted-foreground/40"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-foreground block truncate">{workspace.name}</span>
                      <span className="text-xs text-muted-foreground block">
                        ({workspace.plan}) · {roleLabel}
                      </span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {isOwner
                          ? t("workspaceSourceOwned")
                          : invitedByName
                            ? t("workspaceSourceInvitedBy", { name: invitedByName })
                            : t("workspaceSourceInvited")}
                      </span>
                    </div>
                    <ShieldCheck
                      size={18}
                      className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/40"}`}
                    />
                  </button>

                  {isOwner && (
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end sm:self-auto">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            minLength={2}
                            maxLength={60}
                            className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveName(workspace.id)}
                            className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            title={t("saveNameTitle")}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWorkspaceId(null);
                              setEditName("");
                            }}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                            title={t("cancelEditTitle")}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWorkspaceId(workspace.id);
                              setEditName(workspace.name);
                            }}
                            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2.5 sm:p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors flex items-center justify-center"
                            title={t("editNameTitle")}
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkspaceToDelete(workspace)}
                            disabled={isDeleting}
                            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2.5 sm:p-2 rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-70 flex items-center justify-center"
                            title={t("deleteTitle")}
                          >
                            {isDeleting ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {!isOwner && (
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setWorkspaceToLeave(workspace)}
                        disabled={isLeaving}
                        className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2.5 sm:p-2 rounded-lg text-amber-600 hover:bg-amber-500/10 transition-colors disabled:opacity-70 flex items-center justify-center"
                        title={t("leaveTitle")}
                      >
                        {isLeaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <LogOut size={16} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-rose-600" role="alert">
            {actionError}
          </p>
        )}
      </section>
      )}

      {activeTab === "members" && (
      <section className="bg-card rounded-xl sm:rounded-2xl shadow-card border border-border p-4 sm:p-8 transition-colors">
        <h2 className="text-base sm:text-xl font-bold text-foreground mb-1">
          {t("membersTitle")} {activeWorkspace ? `- ${activeWorkspace.name}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("membersSubtitle")}
        </p>
        <WorkspaceMembersClient
          workspaceId={activeWorkspaceId}
          members={workspaceMembers}
          invites={[]}
          canManage={canManageMembers}
          currentUserId={userId}
          showMembersOnly
        />
      </section>
      )}

      {activeTab === "share" && (
      <section className="bg-card rounded-xl sm:rounded-2xl shadow-card border border-border p-4 sm:p-8 transition-colors">
        <h2 className="text-base sm:text-xl font-bold text-foreground mb-1">
          {t("shareTitle")} {activeWorkspace ? `- ${activeWorkspace.name}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("shareSubtitle")}
        </p>
        <WorkspaceMembersClient
          workspaceId={activeWorkspaceId}
          members={workspaceMembers}
          invites={workspaceInvites}
          canManage={canManageMembers}
          currentUserId={userId}
        />
      </section>
      )}

      {activeTab === "perfil" && (
      <ProfileTab userEmail={userEmail} userFullName={userFullName} />
      )}

      {workspaceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
            {workspaces.length === 1 ? (
              <>
                <h3 className="text-lg font-bold text-foreground">
                  {t("cannotDeleteOnlyWorkspaceTitle")}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("cannotDeleteOnlyWorkspaceMessage")}
                </p>
                <div className="mt-5 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setWorkspaceToDelete(null)}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/40 transition-colors"
                  >
                    {t("understand")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-foreground">{t("confirmDeleteTitle")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("confirmDeleteMessage", { name: workspaceToDelete.name })}
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWorkspaceToDelete(null)}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/40 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkspace(workspaceToDelete)}
                    disabled={deletingWorkspaceId === workspaceToDelete.id}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-70 inline-flex items-center gap-2"
                  >
                    {deletingWorkspaceId === workspaceToDelete.id ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t("deleting")}
                      </>
                    ) : (
                      t("delete")
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {workspaceToLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">{t("confirmLeaveTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("confirmLeaveMessage", { name: workspaceToLeave.name })}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWorkspaceToLeave(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/40 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleLeaveWorkspace(workspaceToLeave)}
                disabled={leavingWorkspaceId === workspaceToLeave.id}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-70 inline-flex items-center gap-2"
              >
                {leavingWorkspaceId === workspaceToLeave.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("leaving")}
                  </>
                ) : (
                  t("leave")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] space-y-2 w-[min(92vw,360px)]">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
                toast.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
