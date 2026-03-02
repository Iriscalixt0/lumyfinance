import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import {
  Users, Plus, Pencil, Trash2, Mail, Copy, Check, Crown, Shield, Eye, UserPlus, LogOut,
  LayoutGrid, Share2, User,
} from "lucide-react";

interface WsRow {
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
}

interface Invite {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  token: string;
}

const ROLE_ICONS: Record<string, typeof Crown> = { owner: Crown, admin: Shield, editor: Pencil, viewer: Eye };
const ROLE_LABELS: Record<string, string> = { owner: "Dono", admin: "Admin", editor: "Editor", viewer: "Visualizador" };

type Tab = "workspaces" | "members" | "share" | "profile";

export function WorkspacePage() {
  const { user } = useAuth();
  const { activeWorkspace, switchWorkspace: switchGlobalWs, reload: reloadCtx } = useWorkspace();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("workspaces");
  const [workspaces, setWorkspaces] = useState<WsRow[]>([]);
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

  // Profile
  const [fullName, setFullName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const isOwner = activeWorkspace?.owner_id === user?.id;

  useEffect(() => { loadWorkspaces(); }, [user]);
  useEffect(() => { if (activeWorkspace) loadMembers(activeWorkspace.id); }, [activeWorkspace]);
  useEffect(() => { loadProfile(); }, [user]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (data) setFullName(data.full_name || "");
  }

  async function saveProfile() {
    if (!user) return;
    setProfileSaving(true);
    await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    setProfileSaving(false);
    toast("Perfil salvo!");
  }

  async function loadWorkspaces() {
    if (!user) { setLoading(false); return; }
    const { data: memberRows } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id);
    if (!memberRows?.length) { setLoading(false); return; }
    const wsIds = memberRows.map((m) => m.workspace_id);
    const { data: wsList } = await supabase
      .from("workspaces").select("*").in("id", wsIds).order("created_at");
    setWorkspaces(wsList ?? []);
    setLoading(false);
  }

  async function loadMembers(wsId: string) {
    const { data: memberRows } = await supabase
      .from("workspace_members").select("id, user_id, role").eq("workspace_id", wsId);
    if (memberRows) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);
      setMembers(memberRows.map((m) => ({ ...m, full_name: profileMap.get(m.user_id) || "Usuário" })));
    }
    const { data: inviteRows } = await supabase
      .from("workspace_invites").select("id, email, role, token").eq("workspace_id", wsId);
    setInvites(inviteRows ?? []);
  }

  async function handleRename() {
    if (!activeWorkspace || !renameValue.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("workspaces").update({ name: renameValue.trim() }).eq("id", activeWorkspace.id);
    setSaving(false);
    if (error) { toast("Erro ao renomear."); return; }
    await reloadCtx(); await loadWorkspaces();
    setRenameOpen(false);
    toast("Workspace renomeado!");
  }

  async function handleDelete() {
    if (!activeWorkspace) return;
    if (workspaces.length <= 1) { toast("Não é possível excluir o único workspace."); return; }
    setSaving(true);
    const { error } = await supabase.from("workspaces").delete().eq("id", activeWorkspace.id);
    setSaving(false);
    if (error) { toast("Erro ao excluir."); return; }
    await reloadCtx(); await loadWorkspaces();
    setDeleteOpen(false);
    toast("Workspace excluído!");
  }

  async function handleCreateWorkspace() {
    if (!newWsName.trim() || !user) return;
    setSaving(true);
    const slug = newWsName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data, error } = await supabase
      .from("workspaces").insert({ name: newWsName.trim(), slug: slug || "workspace", owner_id: user.id }).select().single();
    if (error) { setSaving(false); toast("Erro ao criar workspace."); return; }
    await supabase.from("workspace_members").insert({ workspace_id: data.id, user_id: user.id, role: "owner" });
    setSaving(false);
    await reloadCtx(); await loadWorkspaces();
    setCreateOpen(false); setNewWsName("");
    toast("Workspace criado!");
  }

  async function handleInvite() {
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setSaving(true);
    const token = crypto.randomUUID();
    const { data, error } = await supabase.from("workspace_invites").insert({
      workspace_id: activeWorkspace.id, email: inviteEmail.trim(), role: inviteRole, token,
      invited_by: user!.id, expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    setSaving(false);
    if (error) { toast("Erro ao convidar."); return; }
    setInvites((prev) => [...prev, data]);
    setInviteOpen(false); setInviteEmail("");
    toast("Convite enviado!");
  }

  async function removeMember(memberId: string, memberUserId: string) {
    if (memberUserId === user?.id) { toast("Você não pode remover a si mesmo."); return; }
    if (memberUserId === activeWorkspace?.owner_id) { toast("O dono não pode ser removido."); return; }
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
    if (!activeWorkspace || isOwner) { toast("O dono não pode sair do workspace."); return; }
    const member = members.find((m) => m.user_id === user?.id);
    if (!member) return;
    await supabase.from("workspace_members").delete().eq("id", member.id);
    await reloadCtx(); await loadWorkspaces();
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

  const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { key: "workspaces", label: "Workspaces", icon: LayoutGrid },
    { key: "members", label: "Membros", icon: Users },
    { key: "share", label: "Compartilhar", icon: Share2 },
    { key: "profile", label: "Perfil", icon: User },
  ];

  return (
    <div className="animate-fade space-y-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Workspace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crie, edite e exclua seus workspaces e gerencie membros.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Workspaces ── */}
      {tab === "workspaces" && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">Seus workspaces</h2>
              </div>
              <p className="text-xs text-muted-foreground">Escolha o ativo e gerencie os que você criou.</p>
            </div>
            <button
              onClick={() => { setNewWsName(""); setCreateOpen(true); }}
              className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Novo workspace
            </button>
          </div>

          <div className="space-y-2">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace?.id;
              return (
                <div
                  key={ws.id}
                  onClick={() => switchGlobalWs(ws)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    isActive
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}>
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{ws.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ws.owner_id === user?.id ? "Dono · " : ""}Workspace privado
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                    {ws.owner_id === user?.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenameValue(ws.name); setRenameOpen(true); }}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Renomear"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {ws.owner_id !== user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); leaveWorkspace(); }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Sair"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Tab: Membros ── */}
      {tab === "members" && activeWorkspace && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  Membros de {activeWorkspace.name}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">{members.length} membro(s) no workspace ativo.</p>
            </div>
            {isOwner && (
              <button
                onClick={() => { setInviteEmail(""); setInviteOpen(true); }}
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" /> Convidar
              </button>
            )}
          </div>

          <div className="space-y-1">
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
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Tab: Compartilhar ── */}
      {tab === "share" && activeWorkspace && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Share2 className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">Compartilhar</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Convide pessoas por e-mail ou compartilhe um link de convite.
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => { setInviteEmail(""); setInviteOpen(true); }}
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" /> Novo convite
              </button>
            )}
          </div>

          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum convite pendente.</p>
          ) : (
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
          )}
        </section>
      )}

      {/* ── Tab: Perfil ── */}
      {tab === "profile" && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Perfil</h2>
            </div>
            <p className="text-xs text-muted-foreground">Informações pessoais do usuário.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              Nome completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              E-mail
            </label>
            <input
              type="email"
              readOnly
              value={user?.email || ""}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm cursor-default focus:outline-none"
            />
          </div>

          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
          >
            {profileSaving ? "Salvando..." : "Salvar perfil"}
          </button>
        </section>
      )}

      {/* ── Modals ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo workspace">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
            <input type="text" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder="Ex: Casa dos Silva"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={50} autoFocus />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCreateOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleCreateWorkspace} disabled={saving || !newWsName.trim()} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Renomear workspace">
        <div className="space-y-4">
          <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" maxLength={50} autoFocus />
          <div className="flex justify-end gap-3">
            <button onClick={() => setRenameOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleRename} disabled={saving || !renameValue.trim()} className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir workspace">
        <p className="text-muted-foreground mb-6 text-sm">
          Tem certeza que deseja excluir <strong className="text-foreground">{activeWorkspace?.name}</strong>? Todos os dados serão perdidos.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar membro">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemplo.com"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Papel</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
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
