import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import {
  Pin,
  Pencil,
  Trash2,
  ArrowLeft,
  History,
  Flame,
  ChevronUp,
  ChevronDown,
  Cloud,
  HardDrive,
  Search,
} from "lucide-react";

/**
 * Gerenciador de Itens Fixos do Supermercado
 * - Edição (nome, qtd, prioridade)
 * - Prioridade: 0 baixa | 1 média | 2 alta
 * - Histórico de skips por mês (lê grocery_item_marks.skipped)
 *
 * Persistência: Supabase. Fallback localStorage para nome/qtd se a tabela
 * não existir; prioridade só funciona com a coluna `priority` migrada.
 */

interface FixedItem {
  id: string;
  name: string;
  qty: string;
  priority: number; // 0-2
  created_at: string;
}

interface SkipRow {
  item_id: string;
  month_key: string;
}

const LS_ITEMS = (ws: string) => `lumy.grocery.items.${ws}`;
const LS_MARKS = (ws: string) => `lumy.grocery.marks.${ws}`;
const LS_PRIORITY = (ws: string) => `lumy.grocery.priority.${ws}`; // {[id]: number}

const PRIORITY_LABEL: Record<number, string> = { 0: "Baixa", 1: "Média", 2: "Alta" };
const PRIORITY_STYLE: Record<number, string> = {
  0: "bg-muted/40 text-muted-foreground border-border",
  1: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
  2: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
};

function monthLabel(key: string, locale = "pt-BR") {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function isMissingTableError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  return err?.code === "42P01" || msg.includes("does not exist") || msg.includes("could not find");
}

function isMissingColumnError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  return err?.code === "42703" || msg.includes("column") && msg.includes("priority");
}

export function GroceryFixedPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const { toast } = useToast();

  const [items, setItems] = useState<FixedItem[]>([]);
  const [skips, setSkips] = useState<SkipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [useCloud, setUseCloud] = useState(true);
  const [hasPriorityCol, setHasPriorityCol] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "name" | "skips">("priority");

  const [editing, setEditing] = useState<FixedItem | null>(null);
  const [historyFor, setHistoryFor] = useState<FixedItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<FixedItem | null>(null);

  // ------- Load -------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!workspaceId) { setLoading(false); return; }
      setLoading(true);

      // Try priority column first
      let q = supabase
        .from("grocery_items")
        .select("id, name, qty, created_at, priority")
        .eq("workspace_id", workspaceId)
        .eq("kind", "fixed")
        .order("created_at", { ascending: false });

      let { data, error } = await q;

      if (error && isMissingColumnError(error)) {
        setHasPriorityCol(false);
        const fb = await supabase
          .from("grocery_items")
          .select("id, name, qty, created_at")
          .eq("workspace_id", workspaceId)
          .eq("kind", "fixed")
          .order("created_at", { ascending: false });
        data = fb.data;
        error = fb.error;
      }

      if (cancelled) return;

      if (error) {
        if (isMissingTableError(error)) {
          setUseCloud(false);
          const ls = JSON.parse(localStorage.getItem(LS_ITEMS(workspaceId)) ?? "[]");
          const prios = JSON.parse(localStorage.getItem(LS_PRIORITY(workspaceId)) ?? "{}");
          const marks = JSON.parse(localStorage.getItem(LS_MARKS(workspaceId)) ?? "[]");
          setItems(
            (ls as any[])
              .filter((i) => i.kind === "fixed")
              .map((i) => ({
                id: i.id,
                name: i.name,
                qty: i.qty || "",
                priority: prios[i.id] ?? 1,
                created_at: i.created_at,
              })),
          );
          setSkips((marks as any[]).filter((m) => m.skipped).map((m) => ({ item_id: m.item_id, month_key: m.month_key })));
        } else {
          toast(error.message || "Erro ao carregar itens fixos");
        }
        setLoading(false);
        return;
      }

      const fixedItems = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        qty: r.qty ?? "",
        priority: typeof r.priority === "number" ? r.priority : 1,
        created_at: r.created_at,
      }));
      setItems(fixedItems);

      // load skips
      const ids = fixedItems.map((i) => i.id);
      if (ids.length) {
        const { data: m } = await supabase
          .from("grocery_item_marks")
          .select("item_id, month_key, skipped")
          .in("item_id", ids)
          .eq("skipped", true);
        if (!cancelled) setSkips((m ?? []).map((r: any) => ({ item_id: r.item_id, month_key: r.month_key })));
      } else {
        setSkips([]);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId, toast]);

  const skipsByItem = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of skips) (map[s.item_id] ||= []).push(s.month_key);
    for (const k of Object.keys(map)) map[k].sort().reverse();
    return map;
  }, [skips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((i) => !q || i.name.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "skips") return (skipsByItem[b.id]?.length ?? 0) - (skipsByItem[a.id]?.length ?? 0);
      // priority desc, then name
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [items, search, sortBy, skipsByItem]);

  // ------- Mutations -------
  async function saveEdit(patch: { name: string; qty: string; priority: number }) {
    if (!editing || !workspaceId) return;
    const id = editing.id;
    const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(next);
    setEditing(null);

    if (useCloud) {
      const payload: any = { name: patch.name, qty: patch.qty || null };
      if (hasPriorityCol) payload.priority = patch.priority;
      const { error } = await supabase.from("grocery_items").update(payload).eq("id", id);
      if (error) {
        if (isMissingColumnError(error)) {
          setHasPriorityCol(false);
          await supabase.from("grocery_items").update({ name: patch.name, qty: patch.qty || null }).eq("id", id);
          // store priority locally
          const prios = JSON.parse(localStorage.getItem(LS_PRIORITY(workspaceId)) ?? "{}");
          prios[id] = patch.priority;
          localStorage.setItem(LS_PRIORITY(workspaceId), JSON.stringify(prios));
          toast("Salvo. Rode a migração para sincronizar prioridade.");
          return;
        }
        toast(error.message || "Erro ao salvar");
        return;
      }
    } else {
      const ls = JSON.parse(localStorage.getItem(LS_ITEMS(workspaceId)) ?? "[]");
      const upd = (ls as any[]).map((i) => (i.id === id ? { ...i, name: patch.name, qty: patch.qty } : i));
      localStorage.setItem(LS_ITEMS(workspaceId), JSON.stringify(upd));
      const prios = JSON.parse(localStorage.getItem(LS_PRIORITY(workspaceId)) ?? "{}");
      prios[id] = patch.priority;
      localStorage.setItem(LS_PRIORITY(workspaceId), JSON.stringify(prios));
    }
    toast("Item atualizado");
  }

  async function bumpPriority(id: string, delta: 1 | -1) {
    const cur = items.find((i) => i.id === id);
    if (!cur) return;
    const next = Math.max(0, Math.min(2, cur.priority + delta));
    if (next === cur.priority) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, priority: next } : i)));
    if (useCloud && hasPriorityCol) {
      const { error } = await supabase.from("grocery_items").update({ priority: next }).eq("id", id);
      if (error && isMissingColumnError(error)) setHasPriorityCol(false);
    }
    if (!hasPriorityCol && workspaceId) {
      const prios = JSON.parse(localStorage.getItem(LS_PRIORITY(workspaceId)) ?? "{}");
      prios[id] = next;
      localStorage.setItem(LS_PRIORITY(workspaceId), JSON.stringify(prios));
    }
  }

  async function deleteItem(id: string) {
    setConfirmDel(null);
    if (useCloud) {
      const { error } = await supabase.from("grocery_items").delete().eq("id", id);
      if (error && !isMissingTableError(error)) {
        toast(error.message || "Erro ao excluir");
        return;
      }
    } else if (workspaceId) {
      const ls = JSON.parse(localStorage.getItem(LS_ITEMS(workspaceId)) ?? "[]");
      localStorage.setItem(LS_ITEMS(workspaceId), JSON.stringify((ls as any[]).filter((i) => i.id !== id)));
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSkips((prev) => prev.filter((s) => s.item_id !== id));
    toast("Item fixo removido");
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            to="/grocery"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a lista
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Pin className="h-6 w-6 text-primary" /> Itens Fixos
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            Edite, defina prioridade e veja em quais meses cada item foi pulado.
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${
                useCloud
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              {useCloud ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
              {useCloud ? "Nuvem" : "Local"}
            </span>
          </p>
        </div>
      </div>

      {!hasPriorityCol && useCloud && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl px-4 py-3 text-sm">
          Para sincronizar prioridade entre dispositivos, rode no Supabase:{" "}
          <code className="font-mono text-xs">supabase/migrations-manual/20260430_grocery_priority.sql</code>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">Ordenar:</span>
          {(["priority", "name", "skips"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                sortBy === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
              }`}
            >
              {s === "priority" ? "Prioridade" : s === "name" ? "Nome" : "Mais pulados"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <Pin className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Nenhum item fixo ainda. Adicione na página de Supermercado."
              : "Nenhum item encontrado para a busca."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((it) => {
            const skipMonths = skipsByItem[it.id] ?? [];
            return (
              <li
                key={it.id}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground truncate">{it.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${PRIORITY_STYLE[it.priority]}`}
                      >
                        {it.priority === 2 && <Flame className="h-3 w-3" />}
                        {PRIORITY_LABEL[it.priority]}
                      </span>
                    </div>
                    {it.qty && (
                      <p className="text-xs text-muted-foreground mt-0.5">{it.qty}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center -my-1">
                    <button
                      onClick={() => bumpPriority(it.id, 1)}
                      disabled={it.priority >= 2}
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Aumentar prioridade"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => bumpPriority(it.id, -1)}
                      disabled={it.priority <= 0}
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Diminuir prioridade"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => setHistoryFor(it)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    title="Ver histórico de meses pulados"
                  >
                    <History className="h-3.5 w-3.5" />
                    {skipMonths.length === 0 ? "Sem skips" : `${skipMonths.length} ${skipMonths.length === 1 ? "skip" : "skips"}`}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(it)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(it)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit modal */}
      {editing && (
        <EditItemModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {/* History modal */}
      {historyFor && (
        <Modal open={true} onClose={() => setHistoryFor(null)} title={`Histórico: ${historyFor.name}`}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Meses em que este item foi removido apenas daquele mês (sem afetar os demais).
            </p>
            {(skipsByItem[historyFor.id] ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-4 text-center">
                Nenhum mês pulado até agora.
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                {(skipsByItem[historyFor.id] ?? []).map((mk) => (
                  <li key={mk} className="px-3 py-2 text-sm capitalize flex items-center justify-between">
                    <span className="text-foreground">{monthLabel(mk)}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
                      Pulado
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <Modal open={true} onClose={() => setConfirmDel(null)} title="Remover item fixo?">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{confirmDel.name}</span> será removido de todos os meses.
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteItem(confirmDel.id)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-destructive text-destructive-foreground hover:brightness-110 transition-all"
              >
                Remover
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: FixedItem;
  onClose: () => void;
  onSave: (patch: { name: string; qty: string; priority: number }) => void;
}) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [priority, setPriority] = useState<number>(item.priority);

  return (
    <Modal open={true} onClose={onClose} title="Editar item fixo">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name: name.trim(), qty: qty.trim(), priority });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Nome
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            maxLength={120}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Quantidade (opcional)
          </label>
          <input
            type="text"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Ex.: 2 unidades"
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            maxLength={60}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Prioridade
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                  priority === p
                    ? `${PRIORITY_STYLE[p]} ring-2 ring-primary/30`
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
