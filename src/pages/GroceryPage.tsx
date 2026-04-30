import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { ShoppingCart, Plus, Trash2, Pin, ChevronLeft, ChevronRight, Check, Cloud, HardDrive, Settings2, Radio, Download, Upload } from "lucide-react";
import { downloadCSV } from "@/lib/utils/csv";

/**
 * SuperMercado — lista de compras com itens fixos (todo mês) e itens do mês.
 *
 * Persistência: Supabase quando a tabela `grocery_items` existir; senão,
 * fallback automático para localStorage por workspace.
 *
 *  Tabelas (SQL: supabase/migrations-manual/20260430_grocery_items.sql):
 *   - grocery_items(id, workspace_id, created_by, name, qty, kind, month_key, ...)
 *       kind: 'fixed' | 'month' ; month_key: 'YYYY-MM' (apenas p/ kind='month')
 *   - grocery_item_marks(item_id, month_key, checked, skipped)
 */

interface GroceryItem {
  id: string;
  name: string;
  qty: string;
  kind: "fixed" | "month";
  month_key: string | null;
  created_at: string;
}

interface GroceryMark {
  item_id: string;
  month_key: string;
  checked: boolean;
  skipped: boolean;
}

const LS_ITEMS = (ws: string) => `lumy.grocery.items.${ws}`;
const LS_MARKS = (ws: string) => `lumy.grocery.marks.${ws}`;

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date, locale = "pt-BR") {
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

// ---------- Local fallback helpers ----------
function lsLoadItems(ws: string): GroceryItem[] {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS(ws)) ?? "[]"); } catch { return []; }
}
function lsSaveItems(ws: string, items: GroceryItem[]) {
  localStorage.setItem(LS_ITEMS(ws), JSON.stringify(items));
}
function lsLoadMarks(ws: string): GroceryMark[] {
  try { return JSON.parse(localStorage.getItem(LS_MARKS(ws)) ?? "[]"); } catch { return []; }
}
function lsSaveMarks(ws: string, marks: GroceryMark[]) {
  localStorage.setItem(LS_MARKS(ws), JSON.stringify(marks));
}

// ---------- Migrate legacy localStorage shape (one-time) ----------
function migrateLegacy(workspaceId: string) {
  const flag = `lumy.grocery.migrated.${workspaceId}`;
  if (localStorage.getItem(flag)) return;

  const items: GroceryItem[] = [];
  const marks: GroceryMark[] = [];

  // legacy fixed
  try {
    const raw = localStorage.getItem(`lumy.grocery.fixed.${workspaceId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      for (const it of arr) {
        items.push({
          id: it.id,
          name: it.name,
          qty: it.qty || "",
          kind: "fixed",
          month_key: null,
          created_at: it.createdAt || new Date().toISOString(),
        });
      }
    }
  } catch { /* ignore */ }

  // legacy month buckets
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const prefix = `lumy.grocery.month.${workspaceId}.`;
    if (!k.startsWith(prefix)) continue;
    const monthKey = k.slice(prefix.length);
    try {
      const data = JSON.parse(localStorage.getItem(k) ?? "{}");
      for (const o of data.oneOff ?? []) {
        items.push({
          id: o.id,
          name: o.name,
          qty: o.qty || "",
          kind: "month",
          month_key: monthKey,
          created_at: o.createdAt || new Date().toISOString(),
        });
        if (o.checked) marks.push({ item_id: o.id, month_key: monthKey, checked: true, skipped: false });
      }
      for (const [fid, v] of Object.entries(data.checked ?? {})) {
        if (v) marks.push({ item_id: fid, month_key: monthKey, checked: true, skipped: false });
      }
      for (const [fid, v] of Object.entries(data.skipped ?? {})) {
        if (v) {
          const existing = marks.find((m) => m.item_id === fid && m.month_key === monthKey);
          if (existing) existing.skipped = true;
          else marks.push({ item_id: fid, month_key: monthKey, checked: false, skipped: true });
        }
      }
    } catch { /* ignore */ }
  }

  if (items.length) lsSaveItems(workspaceId, items);
  if (marks.length) lsSaveMarks(workspaceId, marks);
  localStorage.setItem(flag, "1");
}

export function GroceryPage() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const { user } = useAuth();
  const { toast } = useToast();

  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const mKey = useMemo(() => ymKey(cursor), [cursor]);

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [marks, setMarks] = useState<GroceryMark[]>([]);
  const [tab, setTab] = useState<"all" | "fixed" | "month">("all");
  const [useCloud, setUseCloud] = useState(true); // toggled to false on missing-table errors
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newKind, setNewKind] = useState<"fixed" | "month">("month");

  const [confirmDel, setConfirmDel] = useState<{ id: string; kind: "fixed" | "month"; name: string } | null>(null);

  // Mark lookups
  const markFor = (itemId: string, monthKey: string) =>
    marks.find((m) => m.item_id === itemId && m.month_key === monthKey);

  const isMissingTableError = (err: any): boolean => {
    const msg = (err?.message || "").toLowerCase();
    const code = err?.code;
    return code === "42P01" || msg.includes("does not exist") || msg.includes("relation") || msg.includes("could not find");
  };

  // ---------- Load ----------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!workspaceId) { setLoading(false); return; }
      migrateLegacy(workspaceId);
      setLoading(true);

      // Try cloud first
      const { data: itemsData, error: itemsErr } = await supabase
        .from("grocery_items")
        .select("id, name, qty, kind, month_key, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (itemsErr) {
        if (isMissingTableError(itemsErr)) {
          console.warn("[Grocery] table missing, falling back to localStorage");
          setUseCloud(false);
          setItems(lsLoadItems(workspaceId));
          setMarks(lsLoadMarks(workspaceId));
        } else {
          console.error("[Grocery] load items error", itemsErr);
          toast(itemsErr.message || "Erro ao carregar lista");
        }
        setLoading(false);
        return;
      }

      const ids = (itemsData ?? []).map((i) => i.id);
      let marksData: GroceryMark[] = [];
      if (ids.length) {
        const { data, error } = await supabase
          .from("grocery_item_marks")
          .select("item_id, month_key, checked, skipped")
          .in("item_id", ids);
        if (error && !isMissingTableError(error)) {
          console.error("[Grocery] load marks error", error);
        }
        marksData = (data ?? []) as GroceryMark[];
      }

      // One-time push of legacy local data to cloud (best-effort)
      const localItems = lsLoadItems(workspaceId);
      if (localItems.length && (itemsData?.length ?? 0) === 0 && user) {
        const payload = localItems.map((it) => ({
          id: it.id,
          workspace_id: workspaceId,
          created_by: user.id,
          name: it.name,
          qty: it.qty || null,
          kind: it.kind,
          month_key: it.kind === "month" ? it.month_key : null,
        }));
        const { error: upErr } = await supabase.from("grocery_items").insert(payload);
        if (!upErr) {
          const localMarks = lsLoadMarks(workspaceId);
          if (localMarks.length) {
            await supabase.from("grocery_item_marks").insert(
              localMarks.map((m) => ({
                item_id: m.item_id,
                month_key: m.month_key,
                checked: m.checked,
                skipped: m.skipped,
              }))
            );
          }
          // Reload after migration
          const reload = await supabase
            .from("grocery_items")
            .select("id, name, qty, kind, month_key, created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false });
          if (!cancelled && reload.data) {
            setItems(reload.data as GroceryItem[]);
            const reloadIds = reload.data.map((i: any) => i.id);
            const m2 = await supabase
              .from("grocery_item_marks")
              .select("item_id, month_key, checked, skipped")
              .in("item_id", reloadIds);
            setMarks((m2.data ?? []) as GroceryMark[]);
            // Clear legacy local storage to avoid re-uploading
            localStorage.removeItem(LS_ITEMS(workspaceId));
            localStorage.removeItem(LS_MARKS(workspaceId));
            toast("Lista sincronizada na nuvem");
            setLoading(false);
            return;
          }
        }
      }

      setItems((itemsData ?? []) as GroceryItem[]);
      setMarks(marksData);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [workspaceId, user]);

  // ---------- Persistence helpers ----------
  function persistLocal(nextItems = items, nextMarks = marks) {
    if (!workspaceId) return;
    lsSaveItems(workspaceId, nextItems);
    lsSaveMarks(workspaceId, nextMarks);
  }

  async function upsertMark(itemId: string, patch: Partial<GroceryMark>) {
    const existing = markFor(itemId, mKey);
    const next: GroceryMark = {
      item_id: itemId,
      month_key: mKey,
      checked: existing?.checked ?? false,
      skipped: existing?.skipped ?? false,
      ...patch,
    };
    const nextMarks = [
      ...marks.filter((m) => !(m.item_id === itemId && m.month_key === mKey)),
      next,
    ];
    setMarks(nextMarks);

    if (useCloud) {
      const { error } = await supabase
        .from("grocery_item_marks")
        .upsert(
          { item_id: itemId, month_key: mKey, checked: next.checked, skipped: next.skipped },
          { onConflict: "item_id,month_key" }
        );
      if (error) {
        console.warn("[Grocery] mark upsert failed", error.message);
        if (isMissingTableError(error)) {
          setUseCloud(false);
          persistLocal(items, nextMarks);
        }
      }
    } else {
      persistLocal(items, nextMarks);
    }
  }

  // ---------- Actions ----------
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !workspaceId || !user) return;
    const qty = newQty.trim();
    const id = crypto.randomUUID();

    const newItem: GroceryItem = {
      id,
      name,
      qty,
      kind: newKind,
      month_key: newKind === "month" ? mKey : null,
      created_at: new Date().toISOString(),
    };

    if (useCloud) {
      const { error } = await supabase.from("grocery_items").insert({
        id,
        workspace_id: workspaceId,
        created_by: user.id,
        name,
        qty: qty || null,
        kind: newKind,
        month_key: newKind === "month" ? mKey : null,
      });
      if (error) {
        console.error("[Grocery] insert error", error);
        if (isMissingTableError(error)) {
          setUseCloud(false);
          const nextItems = [newItem, ...items];
          setItems(nextItems);
          persistLocal(nextItems, marks);
        } else {
          toast(error.message || "Erro ao adicionar");
          return;
        }
      } else {
        setItems((prev) => [newItem, ...prev]);
      }
    } else {
      const nextItems = [newItem, ...items];
      setItems(nextItems);
      persistLocal(nextItems, marks);
    }

    toast(newKind === "fixed" ? "Item fixo adicionado — vai aparecer todo mês" : "Item adicionado a este mês");
    setNewName("");
    setNewQty("");
  }

  function toggleFixedChecked(id: string) {
    const cur = markFor(id, mKey);
    upsertMark(id, { checked: !cur?.checked });
  }

  function toggleOneOff(id: string) {
    const cur = markFor(id, mKey);
    upsertMark(id, { checked: !cur?.checked });
  }

  function skipFixedThisMonth(id: string) {
    upsertMark(id, { skipped: true, checked: false });
    toast("Removido apenas deste mês");
  }

  function restoreFixedThisMonth(id: string) {
    upsertMark(id, { skipped: false });
  }

  async function deleteItem(id: string, kind: "fixed" | "month") {
    if (useCloud) {
      const { error } = await supabase.from("grocery_items").delete().eq("id", id);
      if (error && !isMissingTableError(error)) {
        toast(error.message || "Erro ao excluir");
        return;
      }
    }
    const nextItems = items.filter((i) => i.id !== id);
    const nextMarks = marks.filter((m) => m.item_id !== id);
    setItems(nextItems);
    setMarks(nextMarks);
    if (!useCloud) persistLocal(nextItems, nextMarks);
    toast(kind === "fixed" ? "Item fixo removido de todos os meses" : "Item removido");
  }

  function shiftMonth(delta: number) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }

  // ---------- Import / Export ----------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: Array<{ name: string; qty: string; kind: "fixed" | "month"; month_key: string | null; checked: boolean; skipped: boolean }>;
    fileName: string;
    mode: "merge" | "replace";
  } | null>(null);

  function handleExport() {
    if (items.length === 0) {
      toast("Nada para exportar");
      return;
    }
    const headers = ["name", "qty", "kind", "month_key", "checked", "skipped"];
    const rows: string[][] = [];
    for (const it of items) {
      if (it.kind === "fixed") {
        // Uma linha base do fixo
        rows.push([it.name, it.qty || "", "fixed", "", "", ""]);
        // Uma linha extra por mês com marca (checked ou skipped) — preserva histórico
        const itemMarks = marks.filter((m) => m.item_id === it.id && (m.checked || m.skipped));
        for (const m of itemMarks) {
          rows.push([it.name, it.qty || "", "fixed", m.month_key, m.checked ? "1" : "", m.skipped ? "1" : ""]);
        }
      } else {
        const mk = it.month_key ?? "";
        const mark = marks.find((m) => m.item_id === it.id && m.month_key === mk);
        rows.push([it.name, it.qty || "", "month", mk, mark?.checked ? "1" : "", ""]);
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`supermercado-${stamp}.csv`, headers, rows);
    toast(`Exportado: ${rows.length} linha${rows.length === 1 ? "" : "s"}`);
  }

  function parseCSV(text: string): string[][] {
    // Suporta separador ; ou , ; campos com aspas; CRLF/LF; UTF-8 BOM.
    const clean = text.replace(/^\uFEFF/, "");
    const lines: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;
    let sep: "," | ";" | null = null;
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (inQuotes) {
        if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cell += c;
      } else {
        if (c === '"') inQuotes = true;
        else if ((c === "," || c === ";") && (sep === null || c === sep)) {
          if (sep === null) sep = c;
          row.push(cell); cell = "";
        } else if (c === "\n" || c === "\r") {
          if (c === "\r" && clean[i + 1] === "\n") i++;
          row.push(cell); cell = "";
          if (row.length > 1 || row[0] !== "") lines.push(row);
          row = [];
        } else cell += c;
      }
    }
    if (cell !== "" || row.length) { row.push(cell); lines.push(row); }
    return lines;
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar o mesmo arquivo
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result || ""));
        if (parsed.length === 0) { toast("CSV vazio"); return; }
        const header = parsed[0].map((h) => h.trim().toLowerCase());
        const idx = (k: string) => header.indexOf(k);
        const iName = idx("name"), iQty = idx("qty"), iKind = idx("kind"),
              iMonth = idx("month_key"), iChecked = idx("checked"), iSkipped = idx("skipped");
        if (iName === -1 || iKind === -1) {
          toast("CSV inválido — esperado cabeçalho com 'name' e 'kind'");
          return;
        }
        const rows = parsed.slice(1)
          .map((r) => ({
            name: (r[iName] || "").trim(),
            qty: iQty >= 0 ? (r[iQty] || "").trim() : "",
            kind: ((r[iKind] || "").trim().toLowerCase() === "fixed" ? "fixed" : "month") as "fixed" | "month",
            month_key: iMonth >= 0 ? ((r[iMonth] || "").trim() || null) : null,
            checked: iChecked >= 0 ? /^(1|true|yes|sim|x)$/i.test((r[iChecked] || "").trim()) : false,
            skipped: iSkipped >= 0 ? /^(1|true|yes|sim|x)$/i.test((r[iSkipped] || "").trim()) : false,
          }))
          .filter((r) => r.name.length > 0);
        // Validação de month_key para itens 'month'
        const invalid = rows.find((r) => r.kind === "month" && (!r.month_key || !/^[0-9]{4}-[0-9]{2}$/.test(r.month_key)));
        if (invalid) {
          toast(`Linha inválida: '${invalid.name}' (item de mês exige month_key YYYY-MM)`);
          return;
        }
        if (rows.length === 0) { toast("Nenhuma linha válida no CSV"); return; }
        setImportPreview({ rows, fileName: file.name, mode: "merge" });
      } catch (err: any) {
        toast(`Erro ao ler CSV: ${err?.message || "formato inválido"}`);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function confirmImport() {
    if (!importPreview || !workspaceId || !user) return;
    const { rows, mode } = importPreview;
    setImportPreview(null);

    // ---- Replace mode: limpa tudo do workspace primeiro ----
    if (mode === "replace") {
      if (useCloud) {
        const { error } = await supabase.from("grocery_items").delete().eq("workspace_id", workspaceId);
        if (error && !isMissingTableError(error)) {
          toast(`Erro ao limpar: ${error.message}`);
          return;
        }
      } else {
        lsSaveItems(workspaceId, []);
        lsSaveMarks(workspaceId, []);
      }
      setItems([]);
      setMarks([]);
    }

    // ---- Reduz linhas em itens + marcas ----
    // Fixos: uma única entrada por nome (case-insensitive). Linhas extras com month_key viram marcas.
    const fixedByName = new Map<string, { id: string; qty: string }>();
    const newItems: GroceryItem[] = [];
    const newMarks: GroceryMark[] = [];

    // Pré-popula com fixos já existentes (modo merge) para deduplicar
    if (mode === "merge") {
      for (const it of items.filter((i) => i.kind === "fixed")) {
        fixedByName.set(it.name.toLowerCase(), { id: it.id, qty: it.qty });
      }
    }

    for (const r of rows) {
      if (r.kind === "fixed") {
        const key = r.name.toLowerCase();
        let entry = fixedByName.get(key);
        if (!entry) {
          const id = crypto.randomUUID();
          entry = { id, qty: r.qty };
          fixedByName.set(key, entry);
          newItems.push({
            id, name: r.name, qty: r.qty, kind: "fixed",
            month_key: null, created_at: new Date().toISOString(),
          });
        }
        if (r.month_key && (r.checked || r.skipped)) {
          newMarks.push({ item_id: entry.id, month_key: r.month_key, checked: r.checked, skipped: r.skipped });
        }
      } else {
        // item do mês — sempre cria novo (não há chave natural)
        const id = crypto.randomUUID();
        newItems.push({
          id, name: r.name, qty: r.qty, kind: "month",
          month_key: r.month_key, created_at: new Date().toISOString(),
        });
        if (r.checked && r.month_key) {
          newMarks.push({ item_id: id, month_key: r.month_key, checked: true, skipped: false });
        }
      }
    }

    // ---- Persistência ----
    if (useCloud) {
      if (newItems.length) {
        const payload = newItems.map((it) => ({
          id: it.id, workspace_id: workspaceId, created_by: user.id,
          name: it.name, qty: it.qty || null, kind: it.kind,
          month_key: it.kind === "month" ? it.month_key : null,
        }));
        const { error } = await supabase.from("grocery_items").insert(payload);
        if (error) {
          toast(`Erro ao importar itens: ${error.message}`);
          return;
        }
      }
      if (newMarks.length) {
        await supabase.from("grocery_item_marks").upsert(
          newMarks.map((m) => ({ item_id: m.item_id, month_key: m.month_key, checked: m.checked, skipped: m.skipped })),
          { onConflict: "item_id,month_key" },
        );
      }
    }

    const nextItems = [...newItems, ...items.filter((i) => mode === "merge")];
    const nextMarks = (() => {
      // Mescla, sobrescrevendo marcas existentes pelo (item_id, month_key)
      const map = new Map<string, GroceryMark>();
      const base = mode === "merge" ? marks : [];
      for (const m of base) map.set(`${m.item_id}|${m.month_key}`, m);
      for (const m of newMarks) map.set(`${m.item_id}|${m.month_key}`, m);
      return Array.from(map.values());
    })();
    setItems(nextItems);
    setMarks(nextMarks);
    if (!useCloud) persistLocal(nextItems, nextMarks);

    toast(`Importado: ${newItems.length} item${newItems.length === 1 ? "" : "s"}`);
  }

  // ---------- Derived ----------
  const fixedItems = items.filter((i) => i.kind === "fixed");
  const monthItems = items.filter((i) => i.kind === "month" && i.month_key === mKey);

  const visibleFixed = fixedItems.filter((f) => !markFor(f.id, mKey)?.skipped);
  const skippedFixed = fixedItems.filter((f) => markFor(f.id, mKey)?.skipped);

  const totalItems = visibleFixed.length + monthItems.length;
  const checkedCount =
    visibleFixed.filter((f) => markFor(f.id, mKey)?.checked).length +
    monthItems.filter((i) => markFor(i.id, mKey)?.checked).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Supermercado
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            Lista de compras com itens fixos (todo mês) e itens avulsos do mês.
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md ${
                useCloud
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
              title={useCloud ? "Sincronizado entre dispositivos" : "Apenas neste navegador — rode o SQL para sincronizar"}
            >
              {useCloud ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
              {useCloud ? "Nuvem" : "Local"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/grocery/fixed"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors"
            title="Gerenciar itens fixos"
          >
            <Settings2 className="h-3.5 w-3.5" /> Gerenciar fixos
          </Link>
          <Link
            to="/grocery/sync-check"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors"
            title="Verificar sincronização em tempo real"
          >
            <Radio className="h-3.5 w-3.5" /> Verificar sync
          </Link>
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
      </div>

      {!useCloud && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl px-4 py-3 text-sm">
          Para sincronizar entre dispositivos, rode no Supabase:{" "}
          <code className="font-mono text-xs">supabase/migrations-manual/20260430_grocery_items.sql</code>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5">
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Item</label>
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
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Qtd. (opcional)</label>
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
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</label>
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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex bg-card border border-border rounded-xl p-1 text-sm">
          {([
            { key: "all", label: "Todos" },
            { key: "fixed", label: "Fixos" },
            { key: "month", label: "Deste mês" },
          ] as const).map((tt) => (
            <button
              key={tt.key}
              onClick={() => setTab(tt.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                tab === tt.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{checkedCount} de {totalItems} marcados</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {totalItems === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Lista vazia. Adicione seu primeiro item.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(tab === "all" || tab === "fixed") &&
              visibleFixed.map((item) => {
                const isChecked = !!markFor(item.id, mKey)?.checked;
                return (
                  <li key={`f-${item.id}`} className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/30 transition-colors">
                    <button
                      onClick={() => toggleFixedChecked(item.id)}
                      className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                        isChecked ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                      }`}
                      aria-label={isChecked ? "Desmarcar" : "Marcar como comprado"}
                    >
                      {isChecked && <Check className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
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

            {(tab === "all" || tab === "month") &&
              monthItems.map((item) => {
                const isChecked = !!markFor(item.id, mKey)?.checked;
                return (
                  <li key={`m-${item.id}`} className="px-5 py-3 flex items-center gap-3 group hover:bg-muted/30 transition-colors">
                    <button
                      onClick={() => toggleOneOff(item.id)}
                      className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                        isChecked ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                      }`}
                      aria-label={isChecked ? "Desmarcar" : "Marcar como comprado"}
                    >
                      {isChecked && <Check className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.name}
                        {item.qty && <span className="text-muted-foreground font-normal"> · {item.qty}</span>}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">Deste mês</p>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id, "month")}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {(tab === "all" || tab === "fixed") && skippedFixed.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Fixos pulados neste mês ({skippedFixed.length})</h3>
          <ul className="space-y-2">
            {skippedFixed.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground line-through truncate">
                  {item.name}{item.qty && ` · ${item.qty}`}
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

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Excluir item fixo?">
        <p className="text-muted-foreground mb-6">
          “{confirmDel?.name}” será removido de <strong>todos</strong> os meses. Para remover apenas deste mês, use “Pular este mês”.
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
              if (confirmDel) deleteItem(confirmDel.id, confirmDel.kind);
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
