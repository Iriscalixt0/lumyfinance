import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import {
  TrendingUp, TrendingDown, Landmark, Scale, ChevronDown,
  BarChart3, PieChart as PieIcon, Target, CalendarRange, Download, Filter, X,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

const CATEGORY_COLORS = ["#f43f5e","#f59e0b","#3b82f6","#10b981","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

export function AnnualReportPage() {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const { activeWorkspace } = useWorkspace();
  const t = useTranslations("annualReport");
  const [year, setYear] = useState(new Date().getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [rawTxs, setRawTxs] = useState<{ amount: number; type: string; date: string; category: string | null }[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  const [investmentData, setInvestmentData] = useState<{ month: string; total: number }[]>([]);
  const [goalsData, setGoalsData] = useState<{ name: string; current: number; target: number }[]>([]);
  const [totalInvestments, setTotalInvestments] = useState(0);

  // Use translated month short names — fallback to static if not array
  const MONTH_NAMES_SHORT = (() => {
    try {
      const raw = t("monthsShort");
      if (Array.isArray(raw)) return raw as unknown as string[];
      // i18next may return it as comma-separated or object
      return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    } catch {
      return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    }
  })();

  useEffect(() => {
    async function load() {
      if (!activeWorkspace) { setLoading(false); return; }
      setLoading(true);

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, type, date, category")
        .eq("workspace_id", activeWorkspace.id)
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);

      const allTxs = txs ?? [];
      setRawTxs(allTxs);

      const cats = Array.from(new Set(allTxs.map((tx) => tx.category || "Outros"))).sort();
      setAllCategories(cats);
      setSelectedCategories([]);

      const { data: invs } = await supabase
        .from("investments")
        .select("current_value, purchase_date")
        .eq("workspace_id", activeWorkspace.id);

      const invMonthly = Array.from({ length: 12 }, (_, i) => ({ month: MONTH_NAMES_SHORT[i], total: 0 }));
      let invTotal = 0;
      (invs ?? []).forEach((inv) => {
        invTotal += inv.current_value ?? 0;
        const d = new Date(inv.purchase_date);
        if (d.getFullYear() === year) {
          invMonthly[d.getMonth()].total += inv.current_value ?? 0;
        }
      });
      setInvestmentData(invMonthly);
      setTotalInvestments(invTotal);

      const { data: goals } = await supabase
        .from("goals")
        .select("name, current_amount, target_amount")
        .eq("workspace_id", activeWorkspace.id)
        .limit(5);

      setGoalsData((goals ?? []).map((g) => ({ name: g.name, current: g.current_amount, target: g.target_amount })));

      setLoading(false);
    }
    load();
  }, [activeWorkspace, year]);

  const filteredTxs = selectedCategories.length > 0
    ? rawTxs.filter((tx) => selectedCategories.includes(tx.category || "Outros"))
    : rawTxs;

  const computedMonthly = (() => {
    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: MONTH_NAMES_SHORT[i], income: 0, expense: 0 }));
    filteredTxs.forEach((tx) => {
      const idx = new Date(tx.date).getMonth();
      if (tx.type === "income") monthly[idx].income += tx.amount;
      else monthly[idx].expense += tx.amount;
    });
    return monthly;
  })();

  const computedCategoryData = (() => {
    const catMap: Record<string, number> = {};
    filteredTxs.forEach((tx) => {
      if (tx.type !== "income") {
        const cat = tx.category || "Outros";
        catMap[cat] = (catMap[cat] || 0) + tx.amount;
      }
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  })();

  const totalIncome = computedMonthly.reduce((s, m) => s + m.income, 0);
  const totalExpense = computedMonthly.reduce((s, m) => s + m.expense, 0);
  const balance = totalIncome - totalExpense;

  const avgNet = computedMonthly.length ? (totalIncome - totalExpense) / Math.max(computedMonthly.filter(m => m.income > 0 || m.expense > 0).length, 1) : 0;
  const now = new Date();
  const projections = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1);
    return { month: `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`, value: balance + avgNet * (i + 1) };
  });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const tooltipFmt = (v: number) => formatBRL(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleExportPDF() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let y = 10;
      let remainingHeight = imgHeight;
      pdf.addImage(imgData, "PNG", 10, y, imgWidth, imgHeight);
      remainingHeight -= (pageHeight - 20);

      while (remainingHeight > 0) {
        pdf.addPage();
        y = y - (pageHeight - 20);
        pdf.addImage(imgData, "PNG", 10, y, imgWidth, imgHeight);
        remainingHeight -= (pageHeight - 20);
      }

      pdf.save(`relatorio-anual-${year}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="animate-fade space-y-6" ref={reportRef}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t("yearLabel", { year: String(year) })}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-50">
            <Download className="h-4 w-4" />
            {exporting ? t("exporting") : t("exportPdf")}
          </button>
          <div className="relative">
            <button onClick={() => setShowYearPicker(!showYearPicker)}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
              {year} <ChevronDown className="h-4 w-4" />
            </button>
            {showYearPicker && (
              <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                {years.map((y) => (
                  <button key={y} onClick={() => { setYear(y); setShowYearPicker(false); }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted transition ${y === year ? "font-bold text-primary" : "text-foreground"}`}>
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {allCategories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              selectedCategories.length > 0 ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}>
            <Filter className="h-3.5 w-3.5" />
            {selectedCategories.length > 0 ? t("categoriesSelected", { count: String(selectedCategories.length) }) : t("filterCategory")}
          </button>
          {selectedCategories.length > 0 && (
            <button onClick={() => setSelectedCategories([])}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition">
              <X className="h-3 w-3" /> {t("clear")}
            </button>
          )}
          {showCategoryFilter && (
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button key={cat}
                    onClick={() => setSelectedCategories((prev) => active ? prev.filter((c) => c !== cat) : [...prev, cat])}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      active ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"
                    }`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={TrendingUp} label={t("income")} value={formatBRL(totalIncome)} color="text-emerald-500" border="border-emerald-500" />
        <SummaryCard icon={TrendingDown} label={t("expenses")} value={formatBRL(totalExpense)} color="text-rose-500" border="border-rose-500" />
        <SummaryCard icon={Landmark} label={t("investments")} value={formatBRL(totalInvestments)} color="text-blue-500" border="border-blue-500" />
        <SummaryCard icon={Scale} label={t("balance")} value={formatBRL(balance)} color={balance >= 0 ? "text-emerald-500" : "text-rose-500"} border="border-border" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground text-sm mb-4">{t("investmentEvolution")}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={investmentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={tooltipFmt} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey="total" name={t("investments")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">{t("monthlyCashFlow")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={computedMonthly} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={tooltipFmt} />
              <Tooltip formatter={tooltipFmt} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name={t("income")} fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name={t("expenses")} fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> {t("goals")}
          </h3>
          {goalsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground text-sm">
              <Target className="h-8 w-8 mb-2 opacity-40" />
              {t("noGoals")}
            </div>
          ) : (
            <div className="space-y-4">
              {goalsData.map((g, i) => {
                const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{g.name}</span>
                      <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground text-sm mb-4">{t("expensesByCategory")}</h3>
        {computedCategoryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
            <PieIcon className="h-8 w-8 mb-2 opacity-40" />
            {t("noExpenseData")}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={computedCategoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {computedCategoryData.map((_, idx) => (
                    <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipFmt} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {computedCategoryData.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="text-foreground">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            {t("balanceProjection")}
          </h3>
        </div>
        <div className="divide-y divide-border">
          {projections.map((p, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-foreground">{p.month}</span>
              <span className={`text-sm font-semibold ${p.value >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {formatBRL(p.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, border }: { icon: any; label: string; value: string; color: string; border: string }) {
  return (
    <div className={`bg-card border-t-2 ${border} border border-border rounded-xl p-4`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
