import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionBanner } from "@/components/ui/PermissionBanner";
import { useGamification, type AchievementDef } from "@/hooks/useGamification";
import { AchievementToast } from "@/components/gamification/AchievementToast";
import {
  fetchCryptoPrices,
  formatCryptoAmount,
  formatCryptoValue,
  TOP_CRYPTOS,
  type CryptoPrice,
  type CryptoId,
} from "@/lib/utils/coingecko";
import {
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Wallet2,
  Bitcoin,
  ArrowUpDown,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface CryptoHolding {
  id: string;
  coin_id: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  notes: string | null;
  created_at: string;
}

export function CryptoPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;
  const permissions = usePermissions();
  const { checkAchievements } = useGamification(wsId);
  const [newAchievement, setNewAchievement] = useState<AchievementDef | null>(null);

  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [prices, setPrices] = useState<Record<string, CryptoPrice>>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emptyForm = {
    coin_id: "bitcoin" as string,
    quantity: "",
    avg_buy_price: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    if (!wsId) { setLoading(false); return; }
    const [holdingsRes, priceData] = await Promise.all([
      supabase.from("crypto_holdings").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }),
      fetchCryptoPrices(),
    ]);
    setHoldings(holdingsRes.data ?? []);
    setPrices(priceData);
    setLoading(false);
  }, [wsId]);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshPrices = async () => {
    setPricesLoading(true);
    const priceData = await fetchCryptoPrices();
    setPrices(priceData);
    setPricesLoading(false);
    toast("Cotações atualizadas!");
  };

  // Portfolio calculations
  const portfolio = useMemo(() => {
    let totalInvested = 0;
    let totalCurrent = 0;
    const items = holdings.map((h) => {
      const price = prices[h.coin_id];
      const currentPrice = price?.current_price ?? 0;
      const currentValue = h.quantity * currentPrice;
      const investedValue = h.quantity * h.avg_buy_price;
      const pnl = currentValue - investedValue;
      const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
      totalInvested += investedValue;
      totalCurrent += currentValue;
      return { ...h, currentPrice, currentValue, investedValue, pnl, pnlPct, price };
    });
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { items, totalInvested, totalCurrent, totalPnl, totalPnlPct };
  }, [holdings, prices]);

  function openEdit(h: CryptoHolding) {
    setEditingId(h.id);
    setForm({
      coin_id: h.coin_id,
      quantity: String(h.quantity),
      avg_buy_price: String(h.avg_buy_price),
      notes: h.notes || "",
    });
    setFormError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setFormError("");
    setSaving(true);

    const quantity = parseFloat(form.quantity.replace(",", "."));
    const avgBuyPrice = parseFloat(form.avg_buy_price.replace(",", "."));

    if (isNaN(quantity) || quantity <= 0) {
      setFormError("Quantidade inválida.");
      setSaving(false);
      return;
    }
    if (isNaN(avgBuyPrice) || avgBuyPrice < 0) {
      setFormError("Preço médio inválido.");
      setSaving(false);
      return;
    }

    const coin = TOP_CRYPTOS.find((c) => c.id === form.coin_id);
    if (!coin) {
      setFormError("Criptoativo inválido.");
      setSaving(false);
      return;
    }

    const payload = {
      coin_id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      quantity,
      avg_buy_price: avgBuyPrice,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("crypto_holdings").update(payload).eq("id", editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("crypto_holdings").insert({
        ...payload,
        workspace_id: wsId,
        user_id: user!.id,
      });
      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    const { data } = await supabase.from("crypto_holdings").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false });
    setHoldings(data ?? []);
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
    toast(editingId ? "Criptoativo atualizado!" : "Criptoativo adicionado!");
    const newAchs = await checkAchievements();
    if (newAchs && newAchs.length > 0) setNewAchievement(newAchs[0]);
  };

  async function handleDelete() {
    if (!deletingId) return;
    setSaving(true);
    await supabase.from("crypto_holdings").delete().eq("id", deletingId);
    setHoldings((prev) => prev.filter((h) => h.id !== deletingId));
    setSaving(false);
    setDeleteModalOpen(false);
    setDeletingId(null);
    toast("Criptoativo removido!");
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
      {!permissions.canEdit && <PermissionBanner reason={permissions.reason} hasPlan={permissions.hasPlan} isViewer={permissions.isViewer} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Criptoativos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registre suas posições e acompanhe em tempo real.
          </p>
        </div>
        <button
          onClick={refreshPrices}
          disabled={pricesLoading}
          className="border border-border text-foreground font-medium px-3 py-2.5 rounded-xl text-sm hover:bg-secondary transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${pricesLoading ? "animate-spin" : ""}`} />
          Atualizar cotações
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet2 className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor atual</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCryptoValue(portfolio.totalCurrent)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Investido</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCryptoValue(portfolio.totalInvested)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            {portfolio.totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lucro / Prejuízo</span>
          </div>
          <p className={`text-2xl font-bold ${portfolio.totalPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {portfolio.totalPnl >= 0 ? "+" : ""}{formatCryptoValue(portfolio.totalPnl)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Bitcoin className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rentabilidade</span>
          </div>
          <p className={`text-2xl font-bold ${portfolio.totalPnlPct >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {portfolio.totalPnlPct >= 0 ? "+" : ""}{portfolio.totalPnlPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {editingId ? "Editar posição" : "Adicionar criptoativo"}
          </h3>

          {formError && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">{formError}</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Criptoativo</label>
              <select
                value={form.coin_id}
                onChange={(e) => setForm({ ...form, coin_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {TOP_CRYPTOS.map((c) => {
                  const price = prices[c.id];
                  return (
                    <option key={c.id} value={c.id}>
                      {c.symbol} — {c.name} {price ? `(${formatCryptoValue(price.current_price)})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Live price preview */}
            {prices[form.coin_id] && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={prices[form.coin_id].image} alt="" className="h-6 w-6 rounded-full" />
                  <span className="text-sm font-medium text-foreground">{prices[form.coin_id].name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCryptoValue(prices[form.coin_id].current_price)}</p>
                  <p className={`text-[10px] font-semibold ${prices[form.coin_id].price_change_percentage_24h >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {prices[form.coin_id].price_change_percentage_24h >= 0 ? "+" : ""}
                    {prices[form.coin_id].price_change_percentage_24h?.toFixed(2)}% (24h)
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Quantidade</label>
                <input
                  type="text"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="Ex: 0.5"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Preço médio (R$)</label>
                <input
                  type="text"
                  required
                  value={form.avg_buy_price}
                  onChange={(e) => setForm({ ...form, avg_buy_price: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Position value preview */}
            {(() => {
              const qty = parseFloat((form.quantity || "0").replace(",", "."));
              const price = prices[form.coin_id]?.current_price ?? 0;
              if (qty > 0 && price > 0) {
                const value = qty * price;
                const avgPrice = parseFloat((form.avg_buy_price || "0").replace(",", "."));
                const invested = qty * avgPrice;
                const pnl = avgPrice > 0 ? value - invested : 0;
                return (
                  <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor atual da posição:</span>
                      <span className="font-bold text-foreground">{formatCryptoValue(value)}</span>
                    </div>
                    {avgPrice > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lucro/Prejuízo:</span>
                        <span className={`font-bold ${pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                          {pnl >= 0 ? "+" : ""}{formatCryptoValue(pnl)} ({invested > 0 ? ((pnl / invested) * 100).toFixed(2) : "0"}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notas</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Ex: Binance, carteira fria..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={300}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving || !permissions.canEdit}
                className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar posição"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Holdings list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Bitcoin className="h-4 w-4 text-primary" />
              Minha Carteira
            </h3>
            <span className="text-xs text-muted-foreground">{holdings.length} ativo{holdings.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table header */}
          <div className="px-6 py-2 border-b border-border grid grid-cols-5 gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ativo</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Qtd</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Preço atual</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Valor / P&L</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Ações</span>
          </div>

          {portfolio.items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Bitcoin className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-foreground mb-1">Nenhum criptoativo registrado</p>
              <p className="text-xs text-muted-foreground">Adicione sua primeira posição para acompanhar em tempo real.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {portfolio.items.map((item) => (
                <div key={item.id} className="px-6 py-3 grid grid-cols-5 gap-2 items-center group hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    {item.price?.image && <img src={item.price.image} alt="" className="h-5 w-5 rounded-full" />}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.symbol}</p>
                      <p className="text-[10px] text-muted-foreground">{item.name}</p>
                    </div>
                  </div>
                  <p className="text-xs text-foreground text-right font-mono">
                    {formatCryptoAmount(item.quantity, item.symbol)}
                  </p>
                  <div className="text-right">
                    <p className="text-xs font-medium text-foreground">{formatCryptoValue(item.currentPrice)}</p>
                    {item.price && (
                      <p className={`text-[10px] font-semibold ${item.price.price_change_percentage_24h >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {item.price.price_change_percentage_24h >= 0 ? "+" : ""}
                        {item.price.price_change_percentage_24h?.toFixed(2)}%
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{formatCryptoValue(item.currentValue)}</p>
                    <p className={`text-[10px] font-semibold ${item.pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {item.pnl >= 0 ? "+" : ""}{formatCryptoValue(item.pnl)} ({item.pnlPct.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Editar">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => { setDeletingId(item.id); setDeleteModalOpen(true); }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" aria-label="Excluir">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live market ticker */}
      {Object.keys(prices).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">Cotações ao vivo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TOP_CRYPTOS.slice(0, 10).map((c) => {
              const p = prices[c.id];
              if (!p) return null;
              return (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <img src={p.image} alt="" className="h-6 w-6 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{c.symbol}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{formatCryptoValue(p.current_price)}</p>
                  </div>
                  <span className={`text-[10px] font-bold ${p.price_change_percentage_24h >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {p.price_change_percentage_24h >= 0 ? "+" : ""}{p.price_change_percentage_24h?.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Remover criptoativo">
        <p className="text-muted-foreground mb-6">Tem certeza que deseja remover este criptoativo da carteira?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Removendo..." : "Remover"}
          </button>
        </div>
      </Modal>

      <AchievementToast achievement={newAchievement} onDone={() => setNewAchievement(null)} />
    </div>
  );
}
