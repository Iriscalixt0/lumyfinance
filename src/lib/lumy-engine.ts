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

const MONTH_LABELS: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

function monthLabel(mk: string) {
  const [y, m] = mk.split("-");
  return `${MONTH_LABELS[m] || m}/${y}`;
}

function prevMonthKey(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function getLastNMonths(n: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
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
    return { name: cat ? `${cat.icon} ${cat.name}` : "Sem categoria", total, catId };
  });
}

function avgExpenseLast(byMonth: Map<string, Transaction[]>, months: number): number {
  const keys = getLastNMonths(months);
  let total = 0;
  let count = 0;
  for (const k of keys) {
    const txs = byMonth.get(k);
    if (txs) {
      total += sumByType(txs, "expense");
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

function categoryTrend(
  byMonth: Map<string, Transaction[]>,
  catId: string,
  currentMk: string
): { current: number; previous: number; pct: number } | null {
  const prevMk = prevMonthKey(currentMk);
  const currentTxs = byMonth.get(currentMk) || [];
  const prevTxs = byMonth.get(prevMk) || [];
  const current = currentTxs.filter((t) => t.category_id === catId && t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const previous = prevTxs.filter((t) => t.category_id === catId && t.type === "expense").reduce((s, t) => s + t.amount, 0);
  if (previous === 0 && current === 0) return null;
  const pct = previous > 0 ? ((current - previous) / previous) * 100 : 100;
  return { current, previous, pct };
}

function dayOfWeekAnalysis(txs: Transaction[]): { bestDay: string; worstDay: string; avgByDay: Map<string, number> } {
  const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const tx of txs.filter((t) => t.type === "expense")) {
    const day = DAYS[new Date(tx.date + "T12:00:00").getDay()];
    totals.set(day, (totals.get(day) || 0) + tx.amount);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  const avgByDay = new Map<string, number>();
  for (const [day, total] of totals) {
    avgByDay.set(day, Math.round(total / (counts.get(day) || 1)));
  }
  const sorted = [...avgByDay.entries()].sort((a, b) => b[1] - a[1]);
  return {
    bestDay: sorted.length > 0 ? sorted[sorted.length - 1][0] : "N/A",
    worstDay: sorted.length > 0 ? sorted[0][0] : "N/A",
    avgByDay,
  };
}

// ─── main analysis ──────────────────────────────────
export function analyzeTransactions(
  transactions: Transaction[],
  categories: Category[]
): LumyInsight[] {
  const insights: LumyInsight[] = [];
  if (transactions.length === 0) {
    insights.push(
      {
        id: "welcome",
        icon: "👋",
        title: "Bem-vindo ao Lumy!",
        body: "Eu sou seu assistente financeiro pessoal. Estou aqui para te ajudar a organizar suas finanças, encontrar onde economizar e alcançar seus objetivos.",
        type: "info",
      },
      {
        id: "tip-start",
        icon: "🚀",
        title: "Comece registrando suas transações",
        body: "Vá até a página de Transações e registre suas receitas e despesas. Quanto mais dados eu tiver, melhores serão minhas análises e dicas personalizadas!",
        type: "tip",
      },
      {
        id: "tip-5030",
        icon: "💡",
        title: "Dica: Regra 50-30-20",
        body: "Uma boa regra para organizar suas finanças: destine 50% da renda para necessidades, 30% para desejos e 20% para poupança e investimentos.",
        type: "tip",
      },
      {
        id: "tip-emergency",
        icon: "🛡️",
        title: "Reserva de emergência",
        body: "O ideal é ter de 3 a 6 meses de despesas guardados como reserva de emergência. Comece com uma meta pequena e vá aumentando!",
        type: "info",
      },
      {
        id: "tip-categories",
        icon: "🏷️",
        title: "Organize por categorias",
        body: "Ao categorizar seus gastos, fica muito mais fácil identificar onde você pode economizar. Crie categorias como Alimentação, Transporte, Lazer, etc.",
        type: "tip",
      }
    );
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

  // 9. Category trend (which category grew the most vs last month)
  const topCats = topCategories(currentTxs, categories, 5);
  for (const cat of topCats) {
    const trend = categoryTrend(byMonth, cat.catId, currentMonth);
    if (trend && trend.previous > 0 && trend.pct > 30) {
      insights.push({
        id: `cat-trend-up-${cat.catId}`,
        icon: "📊",
        title: `${cat.name} subiu ${trend.pct.toFixed(0)}%`,
        body: `Seus gastos com ${cat.name} aumentaram de ${formatBRL(trend.previous)} para ${formatBRL(trend.current)} em relação ao mês passado. Fique de olho!`,
        type: "alert",
      });
    } else if (trend && trend.previous > 0 && trend.pct < -20) {
      insights.push({
        id: `cat-trend-down-${cat.catId}`,
        icon: "📉",
        title: `${cat.name} caiu ${Math.abs(trend.pct).toFixed(0)}%`,
        body: `Ótimo! Você reduziu gastos com ${cat.name} de ${formatBRL(trend.previous)} para ${formatBRL(trend.current)}. Economia de ${formatBRL(trend.previous - trend.current)}.`,
        type: "praise",
      });
    }
  }

  // 10. Average expense comparison (this month vs 3-month average)
  const avg3 = avgExpenseLast(byMonth, 3);
  if (avg3 > 0 && expenseNow > 0) {
    const diff = expenseNow - avg3;
    const pct = (diff / avg3) * 100;
    if (pct > 20) {
      insights.push({
        id: "above-avg",
        icon: "⚡",
        title: "Acima da média trimestral",
        body: `Suas despesas este mês (${formatBRL(expenseNow)}) estão ${pct.toFixed(0)}% acima da sua média dos últimos 3 meses (${formatBRL(avg3)}). Revise seus gastos.`,
        type: "alert",
      });
    } else if (pct < -15) {
      insights.push({
        id: "below-avg",
        icon: "🏆",
        title: "Abaixo da média trimestral!",
        body: `Suas despesas (${formatBRL(expenseNow)}) estão ${Math.abs(pct).toFixed(0)}% abaixo da média dos últimos 3 meses (${formatBRL(avg3)}). Excelente controle!`,
        type: "praise",
      });
    }
  }

  // 11. Day-of-week analysis
  if (currentTxs.filter((t) => t.type === "expense").length >= 5) {
    const dayAnalysis = dayOfWeekAnalysis(currentTxs);
    insights.push({
      id: "day-analysis",
      icon: "📅",
      title: `Você gasta mais na ${dayAnalysis.worstDay}`,
      body: `Seu dia de maior gasto médio é ${dayAnalysis.worstDay}. O dia mais econômico é ${dayAnalysis.bestDay}. Tente planejar compras grandes para dias mais controlados.`,
      type: "info",
    });
  }

  // 12. Uncategorized expenses warning
  const uncategorized = currentTxs.filter((t) => t.type === "expense" && !t.category_id);
  if (uncategorized.length >= 3) {
    const totalUncat = uncategorized.reduce((s, t) => s + t.amount, 0);
    insights.push({
      id: "uncategorized",
      icon: "🏷️",
      title: `${uncategorized.length} despesas sem categoria`,
      body: `Você tem ${formatBRL(totalUncat)} em despesas sem categoria. Categorize-as para ter análises mais precisas e melhores sugestões!`,
      type: "tip",
    });
  }

  // 13. Income diversification
  const incomeDescs = new Map<string, number>();
  for (const tx of currentTxs.filter((t) => t.type === "income")) {
    const key = tx.description.toLowerCase().trim();
    incomeDescs.set(key, (incomeDescs.get(key) || 0) + tx.amount);
  }
  if (incomeDescs.size === 1 && incomeNow > 0) {
    insights.push({
      id: "single-income",
      icon: "⚠️",
      title: "Fonte de renda única",
      body: "Toda sua receita vem de uma única fonte. Considere diversificar com renda extra (freelance, investimentos, etc.) para maior segurança financeira.",
      type: "tip",
    });
  }

  // 14. Spending velocity (% of expenses in the first vs second half)
  const midDay = 15;
  const firstHalf = currentTxs.filter((t) => t.type === "expense" && parseInt(t.date.split("-")[2]) <= midDay);
  const secondHalf = currentTxs.filter((t) => t.type === "expense" && parseInt(t.date.split("-")[2]) > midDay);
  const firstHalfTotal = firstHalf.reduce((s, t) => s + t.amount, 0);
  const secondHalfTotal = secondHalf.reduce((s, t) => s + t.amount, 0);
  if (firstHalfTotal > 0 && secondHalfTotal > 0 && firstHalfTotal > secondHalfTotal * 2) {
    insights.push({
      id: "front-loaded",
      icon: "⏰",
      title: "Gastos concentrados no início do mês",
      body: `${((firstHalfTotal / (firstHalfTotal + secondHalfTotal)) * 100).toFixed(0)}% dos seus gastos aconteceram nos primeiros 15 dias. Tente distribuir melhor ao longo do mês.`,
      type: "tip",
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
  const hasData = transactions.length > 0;

  // ─── Greetings ────────────────────────────────────
  if (q.match(/^(oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e ai|eai|fala)/)) {
    if (!hasData) {
      return "Olá! 👋 Sou a Lumy, sua assistente financeira!\n\nVi que você ainda não tem transações registradas. Que tal começar? Posso te dar **dicas de organização financeira** enquanto isso. Tente perguntar:\n- **\"Me dá uma dica\"**\n- **\"Como economizar?\"**\n- **\"O que é reserva de emergência?\"**";
    }
    return `Olá! 👋 Como posso ajudar hoje?\n\nVocê tem **${currentTxs.length}** transações este mês. Posso analisar seu saldo, despesas, tendências e dar dicas personalizadas!`;
  }

  // ─── Educational content (always available) ───────
  if (q.includes("reserva") || q.includes("emergencia")) {
    return "🛡️ **Reserva de emergência**\n\nÉ o dinheiro guardado para imprevistos (perda de emprego, saúde, reparos urgentes).\n\n**Quanto guardar:** 3 a 6 meses das suas despesas mensais.\n**Onde guardar:** CDB com liquidez diária, Tesouro Selic ou poupança.\n**Como começar:** Separe um valor fixo todo mês, mesmo que pequeno. O importante é a consistência!";
  }

  if (q.includes("investir") || q.includes("investimento") || q.includes("onde aplicar")) {
    return "📊 **Começando a investir**\n\n1. **Primeiro:** Monte sua reserva de emergência\n2. **Renda fixa:** Tesouro Direto, CDB, LCI/LCA — seguro e previsível\n3. **Renda variável:** Ações, FIIs — maior risco, maior potencial\n4. **Diversifique:** Não coloque tudo no mesmo lugar\n\n💡 Comece pela renda fixa e vá diversificando conforme ganhar confiança.";
  }

  if (q.includes("divida") || q.includes("endividado") || q.includes("devendo")) {
    return "🔥 **Saindo das dívidas**\n\n1. **Liste todas** as dívidas (valor, juros, parcelas)\n2. **Priorize** as com juros mais altos (cartão de crédito > empréstimo)\n3. **Negocie:** Bancos costumam dar desconto para quitação\n4. **Evite novas dívidas** enquanto paga as atuais\n5. **Bola de neve:** Pague o mínimo em todas, extra na maior\n\n💡 O cartão de crédito cobra até 400% ao ano — quite primeiro!";
  }

  if (q.includes("cartao") || q.includes("credito")) {
    return "💳 **Usando o cartão com inteligência**\n\n- Use **no máximo 30%** do limite disponível\n- **Nunca** pague o mínimo da fatura — os juros são altíssimos\n- Concentre compras em um só cartão para controlar melhor\n- Aproveite cashback e milhas, mas **não gaste mais por causa deles**\n- Configure alertas de gastos no app do banco";
  }

  if (q.includes("orcamento") || q.includes("organizar") || q.includes("planejar") || q.includes("planejamento")) {
    return "📋 **Organizando seu orçamento**\n\n**Regra 50-30-20:**\n- 50% → Necessidades (moradia, alimentação, transporte)\n- 30% → Desejos (lazer, streaming, restaurantes)\n- 20% → Poupança e investimentos\n\n**Passos práticos:**\n1. Registre todos os gastos por 30 dias\n2. Categorize cada despesa\n3. Identifique cortes possíveis\n4. Defina limites por categoria\n5. Revise semanalmente";
  }

  if (q.match(/(como economizar|economizar dinheiro|gastar menos|reduzir gasto)/)) {
    return "💰 **10 formas de economizar**\n\n1. Cancele assinaturas que não usa\n2. Leve marmita em vez de comer fora\n3. Compare preços antes de comprar\n4. Espere 48h antes de compras por impulso\n5. Use transporte público ou carona\n6. Negocie internet, seguro e celular anualmente\n7. Compre no atacado itens não-perecíveis\n8. Cozinhe em casa nos fins de semana\n9. Evite parcelamento — se não pode à vista, repense\n10. Automatize a poupança no início do mês";
  }

  if (q.includes("imposto") || q.includes("ir ") || q.includes("declarar") || q.includes("irpf")) {
    return "🧾 **Dicas sobre Imposto de Renda**\n\n- Guarde comprovantes de despesas dedutíveis (saúde, educação)\n- Informe todos os rendimentos, mesmo isentos\n- Investimentos devem ser declarados (mesmo sem lucro)\n- Use a declaração pré-preenchida quando disponível\n- Entregue no prazo para evitar multa\n\n💡 Organize seus documentos ao longo do ano, não deixe para o último mês!";
  }

  if (q.includes("meta") || q.includes("objetivo") || q.includes("sonho")) {
    return "🎯 **Definindo metas financeiras**\n\n**Método SMART:**\n- **S**pecífica: \"Juntar R$ 10.000\", não \"economizar dinheiro\"\n- **M**ensurável: Acompanhe o progresso mensalmente\n- **A**lcançável: Seja realista com sua renda\n- **R**elevante: Algo que realmente importa para você\n- **T**emporal: Defina um prazo claro\n\n💡 Use a aba **Metas** do Lumyf para acompanhar seu progresso!";
  }

  // ─── Comparisons & Advanced Analysis ──────────────
  if (q.match(/(compar|mes passado|mes anterior|versus|vs|evoluc|tendencia|historico)/)) {
    if (!hasData) return "Sem dados históricos ainda. Registre transações por pelo menos 2 meses para que eu possa fazer comparações! 📊";
    const prevMk = prevMonthKey(currentMonth);
    const prevTxs = byMonth.get(prevMk) || [];
    const incomePrev = sumByType(prevTxs, "income");
    const expensePrev = sumByType(prevTxs, "expense");
    const balancePrev = incomePrev - expensePrev;

    if (prevTxs.length === 0) return `Sem dados de ${monthLabel(prevMk)} para comparar. Continue registrando para análises futuras!`;

    const expPct = expensePrev > 0 ? ((expenseNow - expensePrev) / expensePrev * 100) : 0;
    const incPct = incomePrev > 0 ? ((incomeNow - incomePrev) / incomePrev * 100) : 0;

    let lines = `📊 **Comparativo: ${monthLabel(currentMonth)} vs ${monthLabel(prevMk)}**\n\n`;
    lines += `| | ${monthLabel(prevMk)} | ${monthLabel(currentMonth)} | Variação |\n`;
    lines += `|---|---|---|---|\n`;
    lines += `| Receitas | ${formatBRL(incomePrev)} | ${formatBRL(incomeNow)} | ${incPct >= 0 ? "+" : ""}${incPct.toFixed(0)}% |\n`;
    lines += `| Despesas | ${formatBRL(expensePrev)} | ${formatBRL(expenseNow)} | ${expPct >= 0 ? "+" : ""}${expPct.toFixed(0)}% |\n`;
    lines += `| Saldo | ${formatBRL(balancePrev)} | ${formatBRL(balanceNow)} | — |\n`;

    if (expPct > 15) lines += `\n⚠️ Despesas subiram ${expPct.toFixed(0)}%. Atenção!`;
    else if (expPct < -10) lines += `\n✅ Ótimo! Despesas caíram ${Math.abs(expPct).toFixed(0)}%.`;

    return lines;
  }

  if (q.match(/(resumo|relatorio|panorama|visao geral|como estou|situacao)/)) {
    if (!hasData) return "Ainda não tenho dados para um resumo. Comece registrando suas transações e volte aqui! 📋";
    const savingsRate = incomeNow > 0 ? ((incomeNow - expenseNow) / incomeNow * 100) : 0;
    const topCats = topCategories(currentTxs, categories, 3);
    const avg3 = avgExpenseLast(byMonth, 3);

    let summary = `📋 **Resumo financeiro — ${monthLabel(currentMonth)}**\n\n`;
    summary += `💰 Receitas: **${formatBRL(incomeNow)}**\n`;
    summary += `💸 Despesas: **${formatBRL(expenseNow)}**\n`;
    summary += `📊 Saldo: **${formatBRL(balanceNow)}**\n`;
    if (incomeNow > 0) summary += `🎯 Taxa de poupança: **${savingsRate.toFixed(0)}%**\n`;
    summary += `📝 Transações: **${currentTxs.length}**\n`;

    if (topCats.length > 0) {
      summary += `\n🏷️ **Top categorias:**\n`;
      topCats.forEach((c, i) => { summary += `${i + 1}. ${c.name} — ${formatBRL(c.total)}\n`; });
    }

    if (avg3 > 0) {
      const diff = ((expenseNow - avg3) / avg3 * 100);
      summary += `\n📈 Média 3 meses: ${formatBRL(avg3)} (${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% este mês)`;
    }

    // Personalized suggestion
    if (savingsRate < 10 && incomeNow > 0) {
      summary += `\n\n💡 **Sugestão:** Sua poupança está baixa. Tente reduzir os gastos na sua maior categoria para aumentar a margem.`;
    } else if (savingsRate >= 20) {
      summary += `\n\n🏆 **Parabéns!** Sua taxa de poupança está excelente. Considere investir o excedente.`;
    }

    return summary;
  }

  if (q.match(/(media|media mensal|media de gasto|quanto gasto por mes)/)) {
    if (!hasData) return "Sem dados para calcular médias. Registre transações por alguns meses! 📊";
    const keys = getLastNMonths(6);
    const monthData: string[] = [];
    for (const k of keys) {
      const txs = byMonth.get(k);
      if (txs && txs.length > 0) {
        const exp = sumByType(txs, "expense");
        const inc = sumByType(txs, "income");
        monthData.push(`${monthLabel(k)}: despesas ${formatBRL(exp)} | receitas ${formatBRL(inc)}`);
      }
    }
    if (monthData.length === 0) return "Sem dados suficientes para calcular médias.";
    const avgExp = avgExpenseLast(byMonth, 6);
    return `📊 **Médias dos últimos ${monthData.length} meses:**\n\n${monthData.join("\n")}\n\n📈 Média de despesas: **${formatBRL(avgExp)}**/mês`;
  }

  if (q.match(/(dia|dia da semana|quando gasto|dia que mais)/)) {
    if (!hasData || currentTxs.filter((t) => t.type === "expense").length < 3) {
      return "Preciso de mais despesas registradas para analisar seu padrão por dia da semana. Continue registrando! 📅";
    }
    const analysis = dayOfWeekAnalysis(currentTxs);
    const dayLines = [...analysis.avgByDay.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([day, avg]) => `${day}: ${formatBRL(avg)} em média`);
    return `📅 **Análise por dia da semana**\n\n${dayLines.join("\n")}\n\n🔴 Dia mais caro: **${analysis.worstDay}**\n🟢 Dia mais econômico: **${analysis.bestDay}**`;
  }

  if (q.match(/(categoria|onde gasto|distribuic|composic)/)) {
    if (!hasData) return "Sem dados de categorias. Registre transações com categorias para essa análise! 🏷️";
    const allCats = topCategories(currentTxs, categories, 10);
    if (allCats.length === 0) return "Nenhuma despesa categorizada este mês. Categorize suas transações para ver a distribuição!";
    const lines = allCats.map((c, i) => {
      const pct = expenseNow > 0 ? (c.total / expenseNow * 100).toFixed(0) : "0";
      return `${i + 1}. ${c.name} — ${formatBRL(c.total)} (**${pct}%**)`;
    });
    return `🏷️ **Distribuição de despesas por categoria**\n\n${lines.join("\n")}\n\nTotal: **${formatBRL(expenseNow)}**`;
  }

  if (q.match(/(nota|score|saude financeira|nota financeira|como estou indo)/)) {
    if (!hasData || incomeNow === 0) return "Preciso de receitas e despesas para calcular sua saúde financeira. Continue registrando! 🏥";
    let score = 50; // base
    const savingsRate = (incomeNow - expenseNow) / incomeNow * 100;
    if (savingsRate >= 20) score += 20;
    else if (savingsRate >= 10) score += 10;
    else if (savingsRate < 0) score -= 20;

    const avg3 = avgExpenseLast(byMonth, 3);
    if (avg3 > 0 && expenseNow <= avg3) score += 10;
    else if (avg3 > 0 && expenseNow > avg3 * 1.2) score -= 10;

    const uncatCount = currentTxs.filter((t) => t.type === "expense" && !t.category_id).length;
    if (uncatCount === 0 && currentTxs.length > 0) score += 10;
    else if (uncatCount > 5) score -= 5;

    if (currentTxs.length >= 10) score += 10; // consistently tracking

    score = Math.max(0, Math.min(100, score));

    let emoji = "😟";
    let label = "Precisa melhorar";
    if (score >= 80) { emoji = "🌟"; label = "Excelente!"; }
    else if (score >= 60) { emoji = "😊"; label = "Bom"; }
    else if (score >= 40) { emoji = "😐"; label = "Regular"; }

    let tips = "";
    if (savingsRate < 20) tips += "\n- Aumente a taxa de poupança para 20%+";
    if (uncatCount > 3) tips += "\n- Categorize suas transações para melhor controle";
    if (avg3 > 0 && expenseNow > avg3 * 1.1) tips += "\n- Reduza gastos para ficar dentro da sua média";

    return `${emoji} **Saúde Financeira: ${score}/100 — ${label}**\n\n📊 Taxa de poupança: ${savingsRate.toFixed(0)}%\n📝 Transações: ${currentTxs.length}\n🏷️ Sem categoria: ${uncatCount}${tips ? `\n\n💡 **Para melhorar:**${tips}` : ""}`;
  }

  // ─── Data-dependent answers ───────────────────────
  if (q.includes("saldo") || q.includes("sobr")) {
    if (!hasData) return "Você ainda não tem transações registradas. Adicione suas receitas e despesas na aba Transações para que eu calcule seu saldo! 📝";
    return `Seu saldo este mês é **${formatBRL(balanceNow)}** (receitas ${formatBRL(incomeNow)} - despesas ${formatBRL(expenseNow)}).`;
  }

  if (q.includes("despesa") || q.includes("gast")) {
    if (!hasData) return "Sem despesas registradas ainda. Comece adicionando seus gastos na aba Transações — assim posso te mostrar onde seu dinheiro está indo! 💸";
    const top = topCategories(currentTxs, categories, 5);
    if (top.length === 0) return "Você não tem despesas registradas este mês.";
    const lines = top.map((c, i) => `${i + 1}. ${c.name} — ${formatBRL(c.total)}`).join("\n");
    return `Suas despesas este mês totalizam **${formatBRL(expenseNow)}**.\n\nPor categoria:\n${lines}`;
  }

  if (q.includes("receita") || q.includes("ganho") || q.includes("renda")) {
    if (!hasData) return "Nenhuma receita registrada ainda. Adicione seus ganhos para que eu possa calcular sua taxa de poupança e dar dicas personalizadas! 💼";
    return `Suas receitas este mês totalizam **${formatBRL(incomeNow)}**.`;
  }

  if (q.includes("economia") || q.includes("economiz") || q.includes("poupar") || q.includes("poupanca")) {
    if (!hasData || incomeNow === 0) return "Sem receitas registradas, não consigo calcular sua taxa de poupança. Mas aqui vai uma dica: tente guardar **pelo menos 20%** da sua renda todo mês. Comece com qualquer valor — o hábito é mais importante que o montante! 🐷";
    const rate = ((incomeNow - expenseNow) / incomeNow) * 100;
    const tip = rate < 20
      ? " Tente cortar gastos variáveis e automatizar uma transferência para poupança no início do mês."
      : " Excelente taxa! Continue assim.";
    return `Sua taxa de poupança é **${rate.toFixed(1)}%** (${formatBRL(balanceNow)} guardados).${tip}`;
  }

  if (q.includes("dica") || q.includes("sugest") || q.includes("ajuda")) {
    // Personalized tips when data exists
    if (hasData && expenseNow > 0) {
      const topCat = topCategories(currentTxs, categories, 1);
      const savingsRate = incomeNow > 0 ? ((incomeNow - expenseNow) / incomeNow * 100) : 0;
      const personalTips: string[] = [];

      if (topCat.length > 0) {
        const catPct = (topCat[0].total / expenseNow * 100).toFixed(0);
        personalTips.push(`🎯 Sua maior categoria é ${topCat[0].name} (${catPct}% das despesas). Tente reduzir 10% aqui e economize **${formatBRL(Math.round(topCat[0].total * 0.1))}**/mês.`);
      }
      if (savingsRate < 20 && incomeNow > 0) {
        const target = Math.round(incomeNow * 0.2);
        const extra = target - balanceNow;
        if (extra > 0) personalTips.push(`💰 Para atingir 20% de poupança, você precisa economizar mais **${formatBRL(extra)}** este mês.`);
      }

      const avg3 = avgExpenseLast(byMonth, 3);
      if (avg3 > 0 && expenseNow > avg3) {
        personalTips.push(`📉 Suas despesas estão **${formatBRL(expenseNow - avg3)}** acima da média. Revise gastos variáveis.`);
      }

      if (personalTips.length > 0) {
        return `💡 **Dicas personalizadas para você:**\n\n${personalTips.join("\n\n")}`;
      }
    }

    const tips = [
      "💡 **Regra 50-30-20:** 50% necessidades, 30% desejos, 20% poupança. É simples e funciona!",
      "💡 **Regra das 48h:** Antes de comprar algo não essencial, espere 48 horas. Se ainda quiser, compre.",
      "💡 **Assinaturas fantasma:** Revise seus débitos automáticos mensalmente. Muita gente paga por serviços que não usa.",
      "💡 **Pague-se primeiro:** Automatize a poupança no início do mês, não espere sobrar no final.",
      "💡 **Negocie anualmente:** Internet, seguro, celular — ligue e peça desconto. Funciona mais do que você imagina!",
      "💡 **Envelope digital:** Separe seu dinheiro em categorias no início do mês. Quando acabar aquela categoria, pare de gastar nela.",
      "💡 **Compras no atacado:** Itens não-perecíveis saem muito mais baratos no atacado. Faça uma compra grande por mês.",
      "💡 **Café de casa:** Um café de R$ 8/dia = R$ 240/mês = R$ 2.880/ano. Pequenos gastos somam rápido!",
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  if (q.includes("maior") || q.includes("grande")) {
    if (!hasData) return "Sem transações registradas ainda. Quando você começar a lançar seus gastos, vou identificar automaticamente os maiores e te alertar! 🔍";
    const expenses = currentTxs.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount);
    if (expenses.length === 0) return "Sem despesas este mês.";
    const top5 = expenses.slice(0, 5);
    const lines = top5.map((t, i) => `${i + 1}. ${t.description} — ${formatBRL(t.amount)}`).join("\n");
    return `Seus maiores gastos este mês:\n${lines}`;
  }

  if (q.includes("quantas") || q.includes("total") || q.includes("numero")) {
    if (!hasData) return "Você tem **0** transações registradas. Vá até a aba Transações para começar! 📝";
    return `Você tem **${currentTxs.length}** transações este mês (${currentTxs.filter((t) => t.type === "income").length} receitas, ${currentTxs.filter((t) => t.type === "expense").length} despesas).`;
  }

  // ─── Fun / personality ────────────────────────────
  if (q.match(/(obrigad|valeu|brigad|thanks)/)) {
    return "De nada! 😊 Estou sempre aqui para ajudar com suas finanças. Qualquer dúvida, é só perguntar!";
  }

  if (q.match(/(quem e voce|quem es tu|o que voce faz|se apresent)/)) {
    return "🤖 Sou a **Lumy**, sua assistente financeira!\n\nEu analiso suas transações e te ajudo a:\n- 📊 Entender para onde seu dinheiro vai\n- 💡 Encontrar formas de economizar\n- 🎯 Alcançar suas metas financeiras\n- 📈 Acompanhar tendências de gastos\n\nAlém disso, posso te ensinar sobre finanças pessoais, investimentos e muito mais!";
  }

  // Default
  return `Posso te ajudar com muita coisa! Experimente:\n\n📊 **Análises:**\n- \"Resumo do mês\" — panorama completo\n- \"Comparar com mês passado\" — evolução\n- \"Minha saúde financeira\" — score 0-100\n- \"Média mensal\" — tendência de gastos\n- \"Dia da semana\" — quando você mais gasta\n- \"Categorias\" — distribuição de despesas\n\n💰 **Dados:**\n- \"Qual meu saldo?\" | \"Minhas despesas\" | \"Maiores gastos\"\n\n💡 **Educação:**\n- \"Como economizar?\" | \"Reserva de emergência\" | \"Investimentos\"\n- \"Dívidas\" | \"Cartão de crédito\" | \"Metas\" | \"IR\"`;
}
