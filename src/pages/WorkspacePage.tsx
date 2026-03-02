import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import {
  Users, Plus, Pencil, Trash2, Mail, Copy, Check, Crown, Shield, Eye, UserPlus, LogOut,
} from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  full_name: string;
  email: string;
}

interface Invite {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  token: string;
}

const ROLE_ICONS: Record<string, typeof Crown> = { owner: Crown, admin: Shield, editor: Pencil, viewer: Eye };
const ROLE_LABELS: Record<string, string> = { owner: "Dono", admin: "Admin", editor: "Editor", viewer: "Visualizador" };

export function WorkspacePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [renameValue, setRenameValue] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isOwner = activeWs?.owner_id === user?.id;

  useEffect(() => {
    loadWorkspaces();
  }, [user]);

  async function loadWorkspaces() {
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user!.id);

    if (!memberRows?.length) { setLoading(false); return; }

    const wsIds = memberRows.map((m) => m.workspace_id);
    const { data: wsList } = await supabase
      .from("workspaces")
      .select("*")
      .in("id", wsIds)
      .order("created_at");

    setWorkspaces(wsList ?? []);
    if (wsList?.length) {
      const ws = wsList[0];
      setActiveWs(ws);
      await loadMembers(ws.id);
    }
    setLoading(false);
  }

  async function loadMembers(wsId: string) {
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("workspace_id", wsId);

    if (memberRows) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);
      setMembers(
        memberRows.map((m) => ({
          ...m,
          full_name: profileMap.get(m.user_id) || "Usuário",
          email: "",
        }))
      );
    }

    const { data: inviteRows } = await supabase
      .from("workspace_invites")
      .select("id, email, role, token")
      .eq("workspace_id", wsId);

    setInvites(inviteRows ?? []);
  }

  async function switchWorkspace(ws: Workspace) {
    setActiveWs(ws);
    await loadMembers(ws.id);
  }

  async function handleRename() {
    if (!activeWs || !renameValue.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: renameValue.trim() })
      .eq("id", activeWs.id);

    setSaving(false);
    if (error) { toast("Erro ao renomear."); return; }
    setWorkspaces((prev) => prev.map((w) => w.id === activeWs.id ? { ...w, name: renameValue.trim() } : w));
    setActiveWs({ ...activeWs, name: renameValue.trim() });
    setRenameOpen(false);
    toast("Workspace renomeado!");
  }

  async function handleDelete() {
    if (!activeWs) return;
    if (workspaces.length <= 1) { toast("Não é possível excluir o único workspace."); return; }
    setSaving(true);
    const { error } = await supabase.from("workspaces").delete().eq("id", activeWs.id);
    setSaving(false);
    if (error) { toast("Erro ao excluir."); return; }
    const remaining = workspaces.filter((w) => w.id !== activeWs.id);
    setWorkspaces(remaining);
    setActiveWs(remaining[0]);
    await loadMembers(remaining[0].id);
    setDeleteOpen(false);
    toast("Workspace excluído!");
  }

  async function handleCreateWorkspace() {
    if (!newWsName.trim() || !user) return;
    setSaving(true);
    const slug = newWsName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: newWsName.trim(), slug: slug || "workspace", owner_id: user.id })
      .select()
      .single();

    if (error) { setSaving(false); toast("Erro ao criar workspace."); return; }

    await supabase.from("workspace_members").insert({
      workspace_id: data.id,
      user_id: user.id,
      role: "owner",
    });

    setSaving(false);
    setWorkspaces((prev) => [...prev, data]);
    setActiveWs(data);
    await loadMembers(data.id);
    setCreateOpen(false);
    setNewWsName("");
    toast("Workspace criado!");
  }

  async function handleInvite() {
    if (!activeWs || !inviteEmail.trim()) return;
    setSaving(true);
    const token = crypto.randomUUID();
    const { data, error } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: activeWs.id,
        email: inviteEmail.trim(),
        role: inviteRole,
        token,
        invited_by: user!.id,
        expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    setSaving(false);
    if (error) { toast("Erro ao convidar."); return; }
    setInvites((prev) => [...prev, data]);
    setInviteOpen(false);
    setInviteEmail("");
    toast("Convite enviado!");
  }

  async function removeMember(memberId: string, memberUserId: string) {
    if (memberUserId === user?.id) { toast("Você não pode remover a si mesmo."); return; }
    if (memberUserId === activeWs?.owner_id) { toast("O dono não pode ser removido."); return; }
    await supabase.from("workspace_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast("Membro removido!");
  }

  async function deleteInvite(inviteId: string) {
    await supabase.from("workspace_invites").delete().eq("id", inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    toast("Convite cancelado!");
  }

  async function leaveWorkspace() {
    if (!activeWs || isOwner) { toast("O dono não pode sair do workspace."); return; }
    const member = members.find((m) => m.user_id === user?.id);
    if (!member) return;
    await supabase.from("workspace_members").delete().eq("id", member.id);
    const remaining = workspaces.filter((w) => w.id !== activeWs.id);
    setWorkspaces(remaining);
    if (remaining.length) {
      setActiveWs(remaining[0]);
      await loadMembers(remaining[0].id);
    }
    toast("Você saiu do workspace.");
  }

  function copyInviteLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast("Link copiado!");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workspace</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus espaços e membros</p>
        </div>
        <button
          onClick={() => { setNewWsName(""); setCreateOpen(true); }}
          className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo workspace
        </button>
      </div>

      {/* Workspace tabs */}
      {workspaces.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => switchWorkspace(ws)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                ws.id === activeWs?.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      )}

      {activeWs && (
        <>
          {/* Workspace info */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{activeWs.name}</h2>
                <p className="text-sm text-muted-foreground">Slug: {activeWs.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <button
                      onClick={() => { setRenameValue(activeWs.name); setRenameOpen(true); }}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Renomear"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteOpen(true)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                {!isOwner && (
                  <button
                    onClick={leaveWorkspace}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                )}
              </div>
            </div>

            {/* Members */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Membros ({members.length})</h3>
                {isOwner && (
                  <button
                    onClick={() => { setInviteEmail(""); setInviteOpen(true); }}
                    className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Convidar
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {members.map((m) => {
                  const RoleIcon = ROLE_ICONS[m.role] || Eye;
                  return (
                    <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {m.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <RoleIcon className="h-3 w-3" /> {ROLE_LABELS[m.role]}
                          </p>
                        </div>
                      </div>
                      {isOwner && m.user_id !== user?.id && m.role !== "owner" && (
                        <button
                          onClick={() => removeMember(m.id, m.user_id)}
                          className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                          aria-label="Remover membro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Convites pendentes</h3>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-secondary/30 group">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-foreground">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABELS[inv.role]}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyInviteLink(inv.token)}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Copiar link"
                        >
                          {copiedToken === inv.token ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => deleteInvite(inv.id)}
                            className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            aria-label="Cancelar convite"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create workspace modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo workspace">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
            <input
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Ex: Casa dos Silva"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              maxLength={50}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCreateOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleCreateWorkspace} disabled={saving || !newWsName.trim()} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Renomear workspace">
        <div className="space-y-4">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            maxLength={50}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setRenameOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleRename} disabled={saving || !renameValue.trim()} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir workspace">
        <p className="text-muted-foreground mb-6">
          Tem certeza que deseja excluir <strong className="text-foreground">{activeWs?.name}</strong>? Todos os dados serão perdidos permanentemente.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </Modal>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar membro">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Papel</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Visualizador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setInviteOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleInvite} disabled={saving || !inviteEmail.trim()} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
