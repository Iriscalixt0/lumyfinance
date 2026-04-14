import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Receipt } from "lucide-react";
import { Link } from "react-router-dom";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  category_id?: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface RecentActivityProps {
  transactions: Transaction[];
  categories: Category[];
}

export function RecentActivity({ transactions, categories }: RecentActivityProps) {
  const t = useTranslations("dashboard");
  const fmt = useIntlFormat();
  const recent = transactions.slice(0, 5);

  const catMap = new Map(categories.map(c => [c.id, c]));

  if (recent.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--card-shadow)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">{t("recentActivity") || "O que rolou"}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">{t("noTransactions") || "Nenhuma transação ainda"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">{t("recentActivity") || "Atividade recente"}</h3>
        <Link
          to="/transactions"
          className="text-xs font-medium text-primary flex items-center gap-0.5 hover:underline"
        >
          {t("viewAll") || "Ver tudo"} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-1">
        {recent.map((tx) => {
          const cat = tx.category_id ? catMap.get(tx.category_id) : null;
          const isExpense = tx.type === "expense";

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                isExpense ? "bg-destructive/10" : "bg-primary/10"
              }`}>
                {cat ? (
                  <span className="text-sm">{cat.icon}</span>
                ) : isExpense ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{tx.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(tx.date).toLocaleDateString()}
                  {cat && ` · ${cat.name}`}
                </p>
              </div>

              <span className={`text-xs font-bold tabular-nums ${
                isExpense ? "text-destructive" : "text-primary"
              }`}>
                {isExpense ? "-" : "+"}{fmt.money(tx.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
