import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { TrendingUp, TrendingDown } from "lucide-react";

interface BalanceForecastCardProps {
  currentBalance: number;
  estimatedEndOfMonth: number;
  recurringExpenses: number;
  recurringIncome: number;
  loading?: boolean;
}

export function BalanceForecastCard({
  currentBalance,
  estimatedEndOfMonth,
  recurringExpenses,
  recurringIncome,
  loading,
}: BalanceForecastCardProps) {
  const t = useTranslations("dashboard");
  const fmt = useIntlFormat();
  const isPositive = estimatedEndOfMonth >= 0;

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
    </div>
  );
}
