import { useState } from "react";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { TrendingUp, TrendingDown, ShoppingBag } from "lucide-react";

interface RecurringItem {
  description: string;
  amount: number;
  type: "income" | "expense";
  dueDay?: number;
}

interface BalanceForecastCardProps {
  currentBalance: number;
  estimatedEndOfMonth: number;
  recurringExpenses: number;
  recurringIncome: number;
  recurringItems?: RecurringItem[];
  loading?: boolean;
}

export function BalanceForecastCard({
  currentBalance,
  estimatedEndOfMonth,
  recurringExpenses,
  recurringIncome,
  recurringItems = [],
  loading,
}: BalanceForecastCardProps) {
  const t = useTranslations("dashboard");
  const fmt = useIntlFormat();
  const [whatIfAmount, setWhatIfAmount] = useState("");
  const [showWhatIf, setShowWhatIf] = useState(false);

  const whatIfValue = parseFloat(whatIfAmount) || 0;
  const projectedWithPurchase = estimatedEndOfMonth - whatIfValue;
  const isPositive = estimatedEndOfMonth >= 0;
  const isProjectedPositive = projectedWithPurchase >= 0;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 animate-pulse space-y-3">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="h-3 w-56 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 animate-fade">
      <div className="flex items-center gap-2 mb-3">
        {isPositive ? (
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        ) : (
          <TrendingDown className="h-5 w-5 text-rose-500" />
        )}
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {t("balanceForecast")}
        </h3>
      </div>

      <p className={`text-3xl font-extrabold tabular-nums ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
        {fmt.money(estimatedEndOfMonth)}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        {t("forecastDesc")}
      </p>

      {/* Recurring items timeline */}
      {recurringItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("upcomingRecurring")}</p>
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {recurringItems.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground truncate max-w-[60%]">{item.description}</span>
                <span className={`font-bold tabular-nums ${item.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                  {item.type === "expense" ? "-" : "+"}{fmt.money(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring summary */}
      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("recIncome")}</p>
          <p className="text-sm font-bold text-emerald-500 tabular-nums">{fmt.money(recurringIncome)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("recExpenses")}</p>
          <p className="text-sm font-bold text-rose-500 tabular-nums">{fmt.money(recurringExpenses)}</p>
        </div>
      </div>

      {/* "What if I buy something today?" */}
      <div className="mt-4 pt-3 border-t border-border">
        {!showWhatIf ? (
          <button
            onClick={() => setShowWhatIf(true)}
            className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            {t("whatIfBuy")}
          </button>
        ) : (
          <div className="space-y-3 animate-fade">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-3.5 w-3.5 text-primary shrink-0" />
              <input
                type="number"
                inputMode="decimal"
                placeholder={t("whatIfPlaceholder")}
                value={whatIfAmount}
                onChange={(e) => setWhatIfAmount(e.target.value)}
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
              <button
                onClick={() => { setShowWhatIf(false); setWhatIfAmount(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {whatIfValue > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("whatIfResult")}</p>
                <p className={`text-lg font-extrabold tabular-nums ${isProjectedPositive ? "text-emerald-500" : "text-rose-500"}`}>
                  {fmt.money(projectedWithPurchase)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
