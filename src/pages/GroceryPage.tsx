import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { ShoppingCart, Plus, Trash2, Pin, ChevronLeft, ChevronRight, Check } from "lucide-react";

/**
 * SuperMercado — lista de compras com itens fixos (recorrentes todo mês)
 * e itens do mês (avulsos, não se repetem).
 *
 * Persistência: localStorage por workspace para não exigir migração de schema.
 *  - lumy.grocery.fixed.{workspaceId}        => GroceryFixedItem[]
 *  - lumy.grocery.month.{workspaceId}.{YYYY-MM} => MonthState
 *      MonthState = {
 *        oneOff: GroceryOneOffItem[],
 *        checked: Record<fixedItemId, boolean>, // marcados como comprados/desmarcados no mês
 *        skipped: Record<fixedItemId, boolean>, // removidos da lista deste mês (não afeta outros)
 *      }
 */

interface GroceryFixedItem {
  id: string;
  name: string;
  qty: string; // free text e.g. "2 L", "1 kg"
  createdAt: string;
}

interface GroceryOneOffItem {
  id: string;
  name: string;
  qty: string;
  checked: boolean;
  createdAt: string;
}

interface MonthState {
  oneOff: GroceryOneOffItem[];
  checked: Record<string, boolean>;
  skipped: Record<string, boolean>;
}

const emptyMonth: MonthState = { oneOff: [], checked: {}, skipped: {} };

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date, locale = "pt-BR") {
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function loadFixed(workspaceId: string): GroceryFixedItem[] {
  try {
    const raw = localStorage.getItem(`lumy.grocery.fixed.${workspaceId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFixed(workspaceId: string, items: GroceryFixedItem[]) {
  localStorage.setItem(`lumy.grocery.fixed.${workspaceId}`, JSON.stringify(items));
}

function loadMonth(workspaceId: string, key: string): MonthState {
  try {
    const raw = localStorage.getItem(`lumy.grocery.month.${workspaceId}.${key}`);
    return raw ? { ...emptyMonth, ...JSON.parse(raw) } : { ...emptyMonth };
  } catch {
    return { ...emptyMonth };
  }
}

function saveMonth(workspaceId: string, key: string, state: MonthState) {
  localStorage.setItem(`lumy.grocery.month.${workspaceId}.${key}`, JSON.stringify(state));
}

export function GroceryPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const { toast } = useToast();

  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const mKey = useMemo(() => monthKey(cursor), [cursor]);

  const [fixed, setFixed] = useState<GroceryFixedItem[]>([]);
  const [month, setMonth] = useState<MonthState>(emptyMonth);
  const [tab, setTab] = useState<"all" | "fixed" | "month">("all");

  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newKind, setNewKind] = useState<"fixed" | "month">("month");

  const [confirmDel, setConfirmDel] = useState<{ id: string; kind: "fixed" | "month"; name: string } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setFixed(loadFixed(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    setMonth(loadMonth(workspaceId, mKey));
  }, [workspaceId, mKey]);

  function persistFixed(next: GroceryFixedItem[]) {
    setFixed(next);
    if (workspaceId) saveFixed(workspaceId, next);
  }

  function persistMonth(next: MonthState) {
    setMonth(next);
    if (workspaceId) saveMonth(workspaceId, mKey, next);
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const qty = newQty.trim();
    const id = crypto.randomUUID();
    if (newKind === "fixed") {
      const item: GroceryFixedItem = { id, name, qty, createdAt: new Date().toISOString() };
      persistFixed([item, ...fixed]);
      toast("Item fixo adicionado — vai aparecer todo mês");
    } else {
      const item: GroceryOneOffItem = { id, name, qty, checked: false, createdAt: new Date().toISOString() };
      persistMonth({ ...month, oneOff: [item, ...month.oneOff] });
      toast("Item adicionado a este mês");
    }
    setNewName("");
    setNewQty("");
  }

  // Toggle "comprado" mark for a fixed item in the current month only
  function toggleFixedChecked(id: string) {
    const checked = { ...month.checked, [id]: !month.checked[id] };
    persistMonth({ ...month, checked });
  }

  // Skip a fixed item from the current month's list (doesn't affect other months)
  function skipFixedThisMonth(id: string) {
    const skipped = { ...month.skipped, [id]: true };
    const checked = { ...month.checked };
    delete checked[id];
    persistMonth({ ...month, skipped, checked });
    toast("Removido apenas deste mês");
  }

  function restoreFixedThisMonth(id: string) {
    const skipped = { ...month.skipped };
    delete skipped[id];
    persistMonth({ ...month, skipped });
  }

  function deleteFixedForever(id: string) {
    persistFixed(fixed.filter((i) => i.id !== id));
    toast("Item fixo removido de todos os meses");
  }

  function toggleOneOff(id: string) {
    const oneOff = month.oneOff.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    persistMonth({ ...month, oneOff });
  }

  function deleteOneOff(id: string) {
    persistMonth({ ...month, oneOff: month.oneOff.filter((i) => i.id !== id) });
  }

  function shiftMonth(delta: number) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }

  // Visible fixed items in the current month (filter out skipped)
  const visibleFixed = fixed.filter((f) => !month.skipped[f.id]);
  const skippedFixed = fixed.filter((f) => month.skipped[f.id]);

  const totalItems = visibleFixed.length + month.oneOff.length;
  const checkedCount =
    visibleFixed.filter((f) => month.checked[f.id]).length + month.oneOff.filter((i) => i.checked).length;

  return (
    <div className="animate-fade space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Supermercado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lista de compras com itens fixos (todo mês) e itens avulsos do mês.
          </p>
        </div>

        {/* Month switcher */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground capitalize px-2 min-w-[140px] text-center">
            {monthLabel(cursor)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Item
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Leite integral"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              maxLength={120}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Qtd. (opcional)
            </label>
            <input
              type="text"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Ex.: 2 L"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              maxLength={40}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Tipo
            </label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as "fixed" | "month")}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="month">Deste mês</option>
              <option value="fixed">Fixo (todo mês)</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </form>
      </div>

      {/* Tabs + summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex bg-card border border-border rounded-xl p-1 text-sm">
          {([
            { key: "all", label: "Todos" },
            { key: "fixed", label: "Fixos" },
            { key: "month", label: "Deste mês" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {checkedCount} de {totalItems} marcados
        </p>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {totalItems === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Lista vazia. Adicione seu primeiro item.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {/* Fixed items */}
            {(tab === "all" || tab === "fixed") &&
              visibleFixed.map((item) => {
                const isChecked = !!month.checked[item.id];
                return (
                  <li
                    key={`f-${item.id}`}
                    className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/30 transition-colors"
                  >
                    <button
                      onClick={() => toggleFixedChecked(item.id)}
                      className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border hover:border-primary"
                      }`}
                      aria-label={isChecked ? "Desmarcar" : "Marcar como comprado"}
                    >
                      {isChecked && <Check className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isChecked ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {item.name}
                        {item.qty && <span className="text-muted-foreground font-normal"> · {item.qty}</span>}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-primary/80 font-bold mt-0.5 flex items-center gap-1">
                        <Pin className="h-3 w-3" /> Fixo
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => skipFixedThisMonth(item.id)}
                        className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Remover apenas deste mês"
                      >
                        Pular este mês
                      </button>
                      <button
                        onClick={() => setConfirmDel({ id: item.id, kind: "fixed", name: item.name })}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Excluir item fixo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}

            {/* One-off items */}
            {(tab === "all" || tab === "month") &&
              month.oneOff.map((item) => (
                <li
                  key={`m-${item.id}`}
                  className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/30 transition-colors"
                >
                  <button
                    onClick={() => toggleOneOff(item.id)}
                    className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                      item.checked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                    aria-label={item.checked ? "Desmarcar" : "Marcar como comprado"}
                  >
                    {item.checked && <Check className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        item.checked ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {item.name}
                      {item.qty && <span className="text-muted-foreground font-normal"> · {item.qty}</span>}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
                      Deste mês
                    </p>
                  </div>
                  <button
                    onClick={() => deleteOneOff(item.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Skipped fixed items (this month) — restore option */}
      {(tab === "all" || tab === "fixed") && skippedFixed.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Fixos pulados neste mês ({skippedFixed.length})
          </h3>
          <ul className="space-y-2">
            {skippedFixed.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-muted-foreground line-through truncate">
                  {item.name}
                  {item.qty && ` · ${item.qty}`}
                </span>
                <button
                  onClick={() => restoreFixedThisMonth(item.id)}
                  className="text-xs px-2 py-1 rounded-md text-primary hover:bg-primary/10 transition-colors font-medium flex-shrink-0"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Excluir item fixo?"
      >
        <p className="text-muted-foreground mb-6">
          “{confirmDel?.name}” será removido de <strong>todos</strong> os meses. Para remover apenas
          deste mês, use “Pular este mês”.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDel(null)}
            className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (confirmDel) deleteFixedForever(confirmDel.id);
              setConfirmDel(null);
            }}
            className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Excluir de todos os meses
          </button>
        </div>
      </Modal>
    </div>
  );
}
