/**
 * Lumy — Rule-based financial analysis engine.
 * No external API. Runs 100% client-side on transaction data.
 */

import { formatBRL } from "@/lib/utils/currency";

interface Transaction {
  id: string;
  description: string;
  amount: number; // cents
  type: "income" | "expense" | "transfer";
  date: string;
  category_id: string | null;
  notes: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

export interface LumyInsight {
  id: string;
  icon: string;
  title: string;
  body: string;
  type: "tip" | "alert" | "praise" | "info";
}

// ─── helpers ────────────────────────────────────────
function monthKey(d: string) {
  return d.substring(0, 7); // YYYY-MM
}

function groupByMonth(txs: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const k = monthKey(tx.date);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(tx);
  }
  return map;
}

function sumByType(txs: Transaction[], type: string) {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

function topCategories(txs: Transaction[], cats: Category[], n = 3) {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !tx.category_id) continue;
    map.set(tx.category_id, (map.get(tx.category_id) || 0) + tx.amount);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return sorted.map(([catId, total]) => {
    const cat = cats.find((c) => c.id === catId);
    return { name: cat ? `${cat.icon} ${cat.name}` : "Sem categoria", total };
  });
}

// ─── main analysis ──────────────────────────────────
export function analyzeTransactions(
  transactions: Transaction[],
  categories: Category[]
): LumyInsight[] {
  const insights: LumyInsight[] = [];
  if (transactions.length === 0) {
    insights.push({
      id: "empty",
      icon: "📝",
      title: "Comece a registrar!",
      body: "Você ainda não tem transações. Adicione suas receitas e despesas para que eu possa te ajudar com análises e dicas.",
      type: "info",
    });
    return insights;
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

  const byMonth = groupByMonth(transactions);
  const currentTxs = byMonth.get(currentMonth) || [];
  const prevTxs = byMonth.get(prevMonth) || [];

  const incomeNow = sumByType(currentTxs, "income");
  const expenseNow = sumByType(currentTxs, "expense");
  const balanceNow = incomeNow - expenseNow;

  const incomePrev = sumByType(prevTxs, "income");
  const expensePrev = sumByType(prevTxs, "expense");

  // 1. Balance overview
  if (balanceNow > 0) {
    insights.push({
      id: "balance-positive",
      icon: "✅",
      title: "Saldo positivo este mês",
      body: `Você tem um saldo de ${formatBRL(balanceNow)} este mês. Continue assim!`,
      type: "praise",
    });
  } else if (balanceNow < 0) {
    insights.push({
      id: "balance-negative",
      icon: "🚨",
      title: "Atenção: saldo negativo",
      body: `Suas despesas superaram suas receitas em ${formatBRL(Math.abs(balanceNow))} este mês. Tente reduzir gastos nas categorias com mais peso.`,
      type: "alert",
    });
  }

  // 2. Expense trend
  if (expensePrev > 0 && expenseNow > 0) {
    const pctChange = ((expenseNow - expensePrev) / expensePrev) * 100;
    if (pctChange > 15) {
      insights.push({
        id: "expense-up",
        icon: "📈",
        title: "Despesas em alta",
        body: `Suas despesas subiram ${pctChange.toFixed(0)}% em relação ao mês passado (de ${formatBRL(expensePrev)} para ${formatBRL(expenseNow)}). Analise onde está gastando mais.`,
        type: "alert",
      });
    } else if (pctChange < -10) {
      insights.push({
        id: "expense-down",
        icon: "📉",
        title: "Despesas reduzidas!",
        body: `Parabéns! Suas despesas caíram ${Math.abs(pctChange).toFixed(0)}% em relação ao mês passado. Você economizou ${formatBRL(expensePrev - expenseNow)}.`,
        type: "praise",
      });
    }
  }

  // 3. Income trend
  if (incomePrev > 0 && incomeNow > 0) {
    const pctChange = ((incomeNow - incomePrev) / incomePrev) * 100;
    if (pctChange < -15) {
      insights.push({
        id: "income-down",
        icon: "⚠️",
        title: "Receita em queda",
        body: `Sua receita caiu ${Math.abs(pctChange).toFixed(0)}% em relação ao mês passado. Considere diversificar fontes de renda.`,
        type: "alert",
      });
    }
  }

  // 4. Top expense categories
  const top = topCategories(currentTxs, categories);
  if (top.length > 0) {
    const lines = top.map((c) => `${c.name}: ${formatBRL(c.total)}`).join("\n");
    insights.push({
      id: "top-categories",
      icon: "🏷️",
      title: "Onde você mais gasta",
      body: `Suas maiores categorias de despesa este mês:\n${lines}`,
      type: "info",
    });
  }

  // 5. Savings rate
  if (incomeNow > 0) {
    const savingsRate = ((incomeNow - expenseNow) / incomeNow) * 100;
    if (savingsRate >= 20) {
      insights.push({
        id: "savings-great",
        icon: "🎯",
        title: "Taxa de poupança excelente!",
        body: `Você está poupando ${savingsRate.toFixed(0)}% da sua renda. A recomendação é pelo menos 20% — e você está alcançando!`,
        type: "praise",
      });
    } else if (savingsRate >= 0 && savingsRate < 10) {
      insights.push({
        id: "savings-low",
        icon: "💡",
        title: "Dica: aumente sua poupança",
        body: `Sua taxa de poupança é ${savingsRate.toFixed(0)}%. Tente guardar pelo menos 20% da renda. Comece reduzindo gastos variáveis.`,
        type: "tip",
      });
    }
  }

  // 6. Large single expenses
  const largeExpenses = currentTxs.filter((t) => t.type === "expense" && t.amount >= 50000); // >= R$500
  if (largeExpenses.length > 0) {
    const largest = largeExpenses.sort((a, b) => b.amount - a.amount)[0];
    insights.push({
      id: "large-expense",
      icon: "💸",
      title: "Gasto significativo detectado",
      body: `"${largest.description}" de ${formatBRL(largest.amount)} foi sua maior despesa individual este mês. Gastos acima de R$ 500 merecem atenção.`,
      type: "info",
    });
  }

  // 7. Recurring patterns
  const descCount = new Map<string, number>();
  for (const tx of currentTxs.filter((t) => t.type === "expense")) {
    const key = tx.description.toLowerCase().trim();
    descCount.set(key, (descCount.get(key) || 0) + 1);
  }
  const repeated = [...descCount.entries()].filter(([, c]) => c >= 3);
  if (repeated.length > 0) {
    const names = repeated.map(([n, c]) => `"${n}" (${c}x)`).join(", ");
    insights.push({
      id: "recurring-pattern",
      icon: "🔄",
      title: "Gastos repetidos detectados",
      body: `Você tem gastos recorrentes: ${names}. Considere negociar descontos ou reavaliar a necessidade.`,
      type: "tip",
    });
  }

  // 8. No income warning
  if (incomeNow === 0 && currentTxs.length > 0) {
    insights.push({
      id: "no-income",
      icon: "📋",
      title: "Nenhuma receita registrada",
      body: "Você ainda não registrou nenhuma receita este mês. Não esqueça de adicionar seus ganhos para ter uma visão completa.",
      type: "info",
    });
  }

  return insights;
}

// ─── Chat-style Q&A ─────────────────────────────────
export function answerQuestion(
  question: string,
  transactions: Transaction[],
  categories: Category[]
): string {
  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const byMonth = groupByMonth(transactions);
  const currentTxs = byMonth.get(currentMonth) || [];

  const incomeNow = sumByType(currentTxs, "income");
  const expenseNow = sumByType(currentTxs, "expense");
  const balanceNow = incomeNow - expenseNow;

  // Keywords routing
  if (q.includes("saldo") || q.includes("sobr")) {
    return `Seu saldo este mês é **${formatBRL(balanceNow)}** (receitas ${formatBRL(incomeNow)} - despesas ${formatBRL(expenseNow)}).`;
  }

  if (q.includes("despesa") || q.includes("gast")) {
    const top = topCategories(currentTxs, categories, 5);
    if (top.length === 0) return "Você não tem despesas registradas este mês.";
    const lines = top.map((c, i) => `${i + 1}. ${c.name} — ${formatBRL(c.total)}`).join("\n");
    return `Suas despesas este mês totalizam **${formatBRL(expenseNow)}**.\n\nPor categoria:\n${lines}`;
  }

  if (q.includes("receita") || q.includes("ganho") || q.includes("renda")) {
    return `Suas receitas este mês totalizam **${formatBRL(incomeNow)}**.`;
  }

  if (q.includes("economia") || q.includes("economiz") || q.includes("poupar") || q.includes("poupanca")) {
    if (incomeNow === 0) return "Sem receitas registradas, não é possível calcular sua taxa de poupança.";
    const rate = ((incomeNow - expenseNow) / incomeNow) * 100;
    const tip = rate < 20
      ? " Tente cortar gastos variáveis e automatizar uma transferência para poupança no início do mês."
      : " Excelente taxa! Continue assim.";
    return `Sua taxa de poupança é **${rate.toFixed(1)}%** (${formatBRL(balanceNow)} guardados).${tip}`;
  }

  if (q.includes("dica") || q.includes("sugest")) {
    const tips = [
      "💡 Regra 50-30-20: 50% necessidades, 30% desejos, 20% poupança.",
      "💡 Antes de comprar algo, espere 48h. Se ainda quiser, compre.",
      "💡 Revise assinaturas mensais — cancele o que não usa.",
      "💡 Automatize a poupança: separe no início do mês, não no final.",
      "💡 Negocie contratos anuais (internet, seguro) por desconto.",
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  if (q.includes("maior") || q.includes("grande")) {
    const expenses = currentTxs.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount);
    if (expenses.length === 0) return "Sem despesas este mês.";
    const top5 = expenses.slice(0, 5);
    const lines = top5.map((t, i) => `${i + 1}. ${t.description} — ${formatBRL(t.amount)}`).join("\n");
    return `Seus maiores gastos este mês:\n${lines}`;
  }

  if (q.includes("quantas") || q.includes("total") || q.includes("numero")) {
    return `Você tem **${currentTxs.length}** transações este mês (${currentTxs.filter((t) => t.type === "income").length} receitas, ${currentTxs.filter((t) => t.type === "expense").length} despesas).`;
  }

  // Default
  return `Posso te ajudar com:\n- **"Qual meu saldo?"** — saldo do mês\n- **"Minhas despesas"** — detalhamento por categoria\n- **"Minha receita"** — total de receitas\n- **"Taxa de poupança"** — quanto você está guardando\n- **"Maiores gastos"** — top despesas do mês\n- **"Dicas"** — sugestões de economia`;
}
