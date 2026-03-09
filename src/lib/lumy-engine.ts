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

// ─── Fuzzy keyword matcher ──────────────────────────
type AnswerHandler = (ctx: QAContext) => string | null;

interface QAContext {
  q: string;
  raw: string;
  hasData: boolean;
  currentMonth: string;
  currentTxs: Transaction[];
  byMonth: Map<string, Transaction[]>;
  categories: Category[];
  transactions: Transaction[];
  incomeNow: number;
  expenseNow: number;
  balanceNow: number;
}

function matchesAny(q: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((p) => (typeof p === "string" ? q.includes(p) : p.test(q)));
}

// ─── Knowledge base for open-ended questions ────────
const KNOWLEDGE_BASE: { keywords: (string | RegExp)[]; answer: string }[] = [
  // ─── Financial education ──────────────────────────
  {
    keywords: ["reserva", "emergencia", "fundo emergenc", "imprevisto", "guardar dinheiro para emergencia"],
    answer: "🛡️ **Reserva de emergência**\n\nÉ o dinheiro guardado para imprevistos (perda de emprego, saúde, reparos urgentes).\n\n**Quanto guardar:** 3 a 6 meses das suas despesas mensais.\n**Onde guardar:** CDB com liquidez diária, Tesouro Selic ou poupança.\n**Como começar:** Separe um valor fixo todo mês, mesmo que pequeno. O importante é a consistência!\n\n💡 Comece com a meta de 1 mês de despesas. Depois vá aumentando.",
  },
  {
    keywords: ["investir", "investimento", "onde aplicar", "aplicacao", "aplicar dinheiro", "renda fixa", "renda variavel", "comecar a investir", "quero investir", "como investir", "melhor investimento"],
    answer: "📊 **Começando a investir**\n\n1. **Primeiro:** Monte sua reserva de emergência\n2. **Renda fixa:** Tesouro Direto, CDB, LCI/LCA — seguro e previsível\n3. **Renda variável:** Ações, FIIs — maior risco, maior potencial\n4. **Diversifique:** Não coloque tudo no mesmo lugar\n\n**Por perfil:**\n• **Conservador:** 80% renda fixa, 20% variável\n• **Moderado:** 60% fixa, 40% variável\n• **Arrojado:** 30% fixa, 70% variável\n\n💡 Comece pela renda fixa e vá diversificando conforme ganhar confiança.",
  },
  {
    keywords: ["divida", "endividado", "devendo", "parcel", "emprestimo", "financiamento", "quitar", "pagar divida", "sair da divida", "negativado", "nome sujo", "cobranca"],
    answer: "🔥 **Saindo das dívidas**\n\n1. **Liste todas** as dívidas (valor, juros, parcelas)\n2. **Priorize** as com juros mais altos (cartão de crédito > empréstimo)\n3. **Negocie:** Bancos costumam dar desconto para quitação\n4. **Evite novas dívidas** enquanto paga as atuais\n5. **Bola de neve:** Pague o mínimo em todas, extra na maior\n\n**Ordem de prioridade de quitação:**\n• Cartão de crédito (até 400% ao ano!)\n• Cheque especial (até 300% ao ano)\n• Empréstimo pessoal\n• Financiamento\n\n💡 Feirões de renegociação (Serasa, bancos) podem dar até 90% de desconto!",
  },
  {
    keywords: ["cartao", "credito", "fatura", "limite", "cashback", "milha", "anuidade", "cartao de credito"],
    answer: "💳 **Usando o cartão com inteligência**\n\n- Use **no máximo 30%** do limite disponível\n- **Nunca** pague o mínimo da fatura — os juros são altíssimos\n- Concentre compras em um só cartão para controlar melhor\n- Aproveite cashback e milhas, mas **não gaste mais por causa deles**\n- Configure alertas de gastos no app do banco\n- Negocie a anuidade — muitos bancos isentam\n\n**Armadilhas comuns:**\n• Rotativo do cartão: até 400% ao ano\n• Parcelamento da fatura: juros de 8-15% ao mês\n• Saques no cartão: taxa + juros altíssimos",
  },
  {
    keywords: ["orcamento", "organizar", "planejar", "planejamento", "controlar gasto", "controle financeiro", "planilha", "organizar financas", "como me organizar"],
    answer: "📋 **Organizando seu orçamento**\n\n**Regra 50-30-20:**\n- 50% → Necessidades (moradia, alimentação, transporte)\n- 30% → Desejos (lazer, streaming, restaurantes)\n- 20% → Poupança e investimentos\n\n**Passos práticos:**\n1. Registre todos os gastos por 30 dias\n2. Categorize cada despesa\n3. Identifique cortes possíveis\n4. Defina limites por categoria\n5. Revise semanalmente\n\n💡 Use o **Lumyf** para registrar tudo automaticamente e acompanhar seu progresso!",
  },
  {
    keywords: [/como economizar/, /economizar dinheiro/, /gastar menos/, /reduzir gasto/, /cortar gasto/, /diminuir gasto/, /dicas? de economia/, /formas? de economizar/, /maneiras? de economizar/],
    answer: "💰 **10 formas de economizar**\n\n1. Cancele assinaturas que não usa\n2. Leve marmita em vez de comer fora\n3. Compare preços antes de comprar\n4. Espere 48h antes de compras por impulso\n5. Use transporte público ou carona\n6. Negocie internet, seguro e celular anualmente\n7. Compre no atacado itens não-perecíveis\n8. Cozinhe em casa nos fins de semana\n9. Evite parcelamento — se não pode à vista, repense\n10. Automatize a poupança no início do mês\n\n💡 Pequenos cortes somam: R$ 10/dia = R$ 300/mês = R$ 3.600/ano!",
  },
  {
    keywords: ["imposto", /\bir\b/, "declarar", "irpf", "leao", "receita federal", "declaracao", "restituicao", "deducao", "isento", "tributacao"],
    answer: "🧾 **Dicas sobre Imposto de Renda**\n\n- Guarde comprovantes de despesas dedutíveis (saúde, educação)\n- Informe todos os rendimentos, mesmo isentos\n- Investimentos devem ser declarados (mesmo sem lucro)\n- Use a declaração pré-preenchida quando disponível\n- Entregue no prazo para evitar multa\n\n**Deduções possíveis:**\n• Saúde: sem limite\n• Educação: até ~R$ 3.500/ano por pessoa\n• Previdência (PGBL): até 12% da renda bruta\n• Dependentes: ~R$ 2.275 por dependente\n\n💡 Compare sempre: declaração completa vs simplificada!",
  },
  {
    keywords: ["meta", "objetivo", "sonho", "plano de vida", "quero juntar", "quero comprar", "como juntar"],
    answer: "🎯 **Definindo metas financeiras**\n\n**Método SMART:**\n- **S**pecífica: \"Juntar R$ 10.000\", não \"economizar dinheiro\"\n- **M**ensurável: Acompanhe o progresso mensalmente\n- **A**lcançável: Seja realista com sua renda\n- **R**elevante: Algo que realmente importa para você\n- **T**emporal: Defina um prazo claro\n\n**Exemplo prático:**\nMeta: R$ 12.000 em 12 meses = R$ 1.000/mês\nInvestindo a 1% ao mês, em 12 meses terá ~R$ 12.680!\n\n💡 Use a aba **Metas** do Lumyf para acompanhar seu progresso!",
  },
  // ─── Investment topics ────────────────────────────
  {
    keywords: ["tesouro", "selic", "tesouro direto", "titulo publico", "tesouro ipca", "tesouro prefixado"],
    answer: "🏦 **Tesouro Direto**\n\nÉ a forma mais segura de investir no Brasil — você empresta dinheiro ao governo.\n\n**Tipos principais:**\n- **Tesouro Selic:** Liquidez diária, ideal para reserva de emergência\n- **Tesouro IPCA+:** Protege contra inflação, bom para longo prazo\n- **Tesouro Prefixado:** Taxa fixa, bom quando juros vão cair\n\n**Mínimo:** Cerca de R$ 30\n**Como começar:** Abra conta em uma corretora (muitas são gratuitas) e compre direto pelo app.\n\n💡 Para reserva de emergência, vá de **Tesouro Selic**!",
  },
  {
    keywords: ["cdb", "lci", "lca", "cri", "cra", "debenture", "fgc", "fundo garantidor"],
    answer: "🏦 **Renda fixa privada**\n\n- **CDB:** Empréstimo a bancos. Procure CDBs que paguem 100%+ do CDI\n- **LCI/LCA:** Isentos de IR para pessoa física. Ótima opção!\n- **Debêntures:** Empréstimo a empresas. Maior risco, maior retorno\n\n**FGC (Fundo Garantidor de Créditos):**\nProtege até R$ 250 mil por CPF por instituição em CDB, LCI, LCA e poupança.\n\n💡 Compare taxas em diferentes bancos e corretoras — a diferença pode ser grande!",
  },
  {
    keywords: ["acao", "acoes", "bolsa", "b3", "bovespa", "mercado de acoes", "comprar acoes", "operar na bolsa", "day trade", "swing trade"],
    answer: "📈 **Investindo em ações**\n\n**O que é:** Comprar um pedacinho de uma empresa listada na bolsa.\n\n**Riscos:** Alta volatilidade — preços sobem e descem diariamente.\n\n**Dicas para iniciantes:**\n1. Nunca invista dinheiro que vai precisar em menos de 5 anos\n2. Comece com ETFs (ex: BOVA11) para diversificar automaticamente\n3. Estude os fundamentos da empresa antes de comprar\n4. Não tente \"acertar o momento\" — invista regularmente\n5. Máximo 5-10% do patrimônio quando iniciante\n\n⚠️ **Day trade** tem taxa de perda de ~95%. Evite se for iniciante!\n\n💡 Dividendos são como um \"aluguel\" que a empresa paga a você!",
  },
  {
    keywords: ["fii", "fundo imobiliario", "fundos imobiliarios", "aluguel passivo", "investir em imovel"],
    answer: "🏠 **Fundos Imobiliários (FIIs)**\n\nInvista em imóveis sem comprar um imóvel inteiro!\n\n**Vantagens:**\n- Receba \"aluguéis\" mensais (dividendos isentos de IR)\n- Diversificação (shoppings, galpões, escritórios)\n- Liquidez — compre e venda na bolsa\n- Comece com menos de R$ 100\n\n**Tipos:**\n- **Tijolo:** Imóveis físicos (shoppings, galpões)\n- **Papel:** Títulos de crédito imobiliário (CRI/CRA)\n- **Fundos de fundos:** Diversificam em outros FIIs\n\n💡 Busque FIIs com dividend yield de 8-12% ao ano e vacância baixa.",
  },
  {
    keywords: ["cripto", "bitcoin", "ethereum", "criptomoeda", "btc", "eth", "blockchain", "nft", "defi", "staking", "mineracao"],
    answer: "🪙 **Criptomoedas**\n\n**O que são:** Moedas digitais descentralizadas.\n\n**Principais:**\n- **Bitcoin (BTC):** A mais conhecida, \"ouro digital\"\n- **Ethereum (ETH):** Plataforma para contratos inteligentes\n- **Stablecoins (USDT, USDC):** Pareadas ao dólar\n\n**Riscos:** Altíssima volatilidade — pode subir ou cair 20% em um dia.\n\n**Regras de ouro:**\n1. Invista apenas o que pode perder 100%\n2. Máximo 5% do patrimônio\n3. Use exchanges reguladas\n4. Nunca compartilhe suas chaves privadas\n5. Desconfie de promessas de retorno garantido\n\n⚠️ Cripto não é para reserva de emergência! Declare no IR.",
  },
  {
    keywords: ["inflacao", "ipca", "poder de compra", "preco subindo", "custo de vida", "tudo caro", "preco aumentou"],
    answer: "📊 **Inflação**\n\nÉ o aumento geral dos preços, que corrói o poder de compra do seu dinheiro.\n\n**IPCA:** Principal índice de inflação no Brasil, medido pelo IBGE.\n\n**Como se proteger:**\n- Investimentos atrelados ao IPCA (Tesouro IPCA+)\n- Renda variável tende a superar a inflação no longo prazo\n- Evite deixar muito dinheiro na poupança (rende menos que a inflação)\n- Negocie reajustes salariais acima da inflação\n\n💡 Se a inflação é 5% ao ano e sua poupança rende 7%, seu ganho real é só 2%.\n\n**Inflação pessoal:** Seus gastos podem subir mais que o IPCA oficial. Acompanhe no Lumyf!",
  },
  {
    keywords: ["juros compostos", "juros", "rendimento", "rentabilidade", "quanto rende", "como funciona juros", "calcular juros"],
    answer: "📈 **Juros compostos — a 8ª maravilha**\n\nÉ quando os juros incidem sobre o valor + juros anteriores.\n\n**Exemplo:**\nR$ 1.000 a 1% ao mês:\n- Mês 1: R$ 1.010\n- Mês 12: R$ 1.126,83\n- Mês 60: R$ 1.816,70\n- Mês 120: R$ 3.300,39\n\n**A mágica é o tempo!** Quanto antes começar, melhor.\n\n💡 A **Regra dos 72**: divida 72 pela taxa anual para saber em quantos anos seu dinheiro dobra.\nEx: 12% ao ano → 72/12 = **6 anos** para dobrar.",
  },
  {
    keywords: ["pix", "ted", "transferencia", "doc", "boleto", "pagamento", "forma de pagamento"],
    answer: "💸 **Meios de pagamento**\n\n- **PIX:** Instantâneo, gratuito, 24h. Use para tudo!\n- **TED:** Útil para valores altos, mesmo dia\n- **Boleto:** Pagamento de contas e compras\n- **Débito automático:** Evita esquecimento, mas cuidado com valores errados\n\n**Dicas de segurança:**\n- Confira o destinatário antes de confirmar o PIX\n- Não clique em links suspeitos de pagamento\n- Use limites de PIX noturnos no app do banco\n- Cadastre chaves PIX apenas nos canais oficiais\n- Ative a verificação em 2 etapas no app do banco",
  },
  {
    keywords: ["seguro", "seguro de vida", "seguro auto", "seguro saude", "plano de saude", "protecao"],
    answer: "🛡️ **Seguros essenciais**\n\n**Prioridade:**\n1. **Seguro de vida:** Se tem dependentes, é essencial\n2. **Plano de saúde:** Avalie custo-benefício vs SUS\n3. **Seguro auto:** Obrigatório se tem carro\n4. **Seguro residencial:** Barato e cobre incêndio, roubo, etc.\n\n**Dicas:**\n- Compare preços em pelo menos 3 seguradoras\n- Renegocie anualmente\n- Leia as exclusões da apólice\n- Franquia mais alta = mensalidade mais baixa\n\n💡 Seguro residencial custa ~R$ 15-30/mês e pode salvar seu patrimônio!",
  },
  {
    keywords: ["aposentadoria", "previdencia", "inss", "pgbl", "vgbl", "aposentar", "futuro", "longo prazo", "planejamento aposentadoria", "quando aposentar", "previdencia privada", "previdencia complementar", "contribuir inss", "tempo de contribuicao"],
    answer: "👴 **Planejamento completo de aposentadoria**\n\n**1. INSS (obrigatório):**\n- CLT: contribuição automática\n- Autônomo/MEI: pague o carnê mensalmente\n- Tempo mínimo: 15-20 anos de contribuição\n- Teto atual: ~R$ 7.800/mês\n\n**2. Previdência privada:**\n- **PGBL:** Deduz até 12% da renda bruta no IR (declaração completa). Ideal para quem ganha acima de ~R$ 5.000\n- **VGBL:** Melhor para declaração simplificada. IR só sobre rendimentos\n- **Tabela regressiva:** Quanto mais tempo, menos IR (de 35% a 10% em 10+ anos)\n- **Atenção:** Taxa de administração ideal < 1%. Acima de 2% é prejuízo!\n\n**3. Alternativas (geralmente mais rentáveis):**\n- Tesouro IPCA+ com vencimento longo\n- Carteira de FIIs para renda passiva\n- Ações pagadoras de dividendos\n- ETFs internacionais para diversificação global\n\n**Quanto preciso para aposentar?**\n- Regra dos 4%: renda mensal desejada × 300\n- Ex: R$ 5.000/mês × 300 = **R$ 1.500.000**\n- Ex: R$ 10.000/mês × 300 = **R$ 3.000.000**\n\n**Simulação (investindo R$ 500/mês a 10% ao ano):**\n- 10 anos: ~R$ 102 mil\n- 20 anos: ~R$ 382 mil\n- 30 anos: ~R$ 1.130.000!\n\n💡 Comece o mais cedo possível — cada ano a mais faz uma diferença enorme graças aos juros compostos!",
  },
  {
    keywords: ["cdi", "taxa selic", "copom", "taxa de juros", "taxa basica", "banco central"],
    answer: "📊 **CDI e Taxa Selic**\n\n- **Selic:** Taxa básica de juros definida pelo COPOM/Banco Central\n- **CDI:** Taxa interbancária, muito próxima da Selic\n\n**Por que importa?**\nA maioria dos investimentos de renda fixa rende um percentual do CDI.\n\n- 100% do CDI = rendimento padrão\n- 120% do CDI = acima da média, ótimo!\n- 80% do CDI = abaixo, busque alternativas\n\n**Comparativo:**\n• Poupança: 70% da Selic + TR\n• CDB bom: 100-120% do CDI\n• Tesouro Selic: ~100% da Selic\n\n💡 Poupança quase sempre perde para CDBs de 100% CDI.",
  },
  {
    keywords: ["score", "score de credito", "serasa", "spc", "nome limpo", "cpf", "cadastro positivo", "consultar cpf", "limpar nome"],
    answer: "📋 **Score de crédito**\n\nÉ uma pontuação (0-1000) que indica o risco de você não pagar uma dívida.\n\n**Como melhorar:**\n1. Pague contas em dia\n2. Mantenha o cadastro atualizado\n3. Evite ter muitas consultas ao CPF\n4. Quite dívidas em aberto\n5. Use o Cadastro Positivo\n\n**Faixas:**\n• 0-300: Muito baixo\n• 301-500: Baixo\n• 501-700: Bom\n• 701-1000: Excelente\n\n💡 Consulte grátis no app da Serasa ou SPC Brasil.",
  },
  {
    keywords: ["consorcio", "consorcio imobiliario", "consorcio de carro", "consorcio vale a pena", "carta de credito consorcio", "lance consorcio", "contemplacao"],
    answer: "🏠 **Consórcio — Guia completo**\n\nÉ uma poupança coletiva: um grupo contribui mensalmente e, por sorteio ou lance, um participante recebe a carta de crédito.\n\n**Como funciona:**\n1. Você escolhe o valor do bem (ex: R$ 200 mil)\n2. Paga parcelas mensais por 60-200 meses\n3. Todo mês, 1+ pessoa é contemplada (sorteio ou lance)\n4. Contemplado recebe a carta de crédito para comprar o bem\n\n**Custos:**\n- Taxa de administração: 10-20% do total (diluída nas parcelas)\n- Fundo de reserva: 1-3%\n- Seguro: ~1%\n- **Não tem juros**, mas os custos totais podem igualar um financiamento\n\n**Tipos mais comuns:**\n- 🏠 Imóvel: prazos de 120-200 meses\n- 🚗 Veículo: prazos de 60-80 meses\n- 🔧 Serviços: reformas, viagens, etc.\n\n**Quando vale a pena:**\n✅ Não tem pressa para comprar\n✅ Quer se forçar a poupar disciplinadamente\n✅ Taxa de administração < 15%\n✅ Tem dinheiro para dar lance e antecipar contemplação\n\n**Quando NÃO vale a pena:**\n❌ Precisa do bem com urgência\n❌ Taxa de administração > 18%\n❌ Não tem disciplina para manter as parcelas\n\n**Dicas:**\n- Compare a taxa de administração entre administradoras\n- Calcule o custo total (parcelas × quantidade) e compare com financiamento\n- Lance embutido: use parte da própria carta como lance\n\n⚠️ Verifique se a administradora é autorizada pelo **Banco Central** (ABAC)!\n\n💡 Se tem disciplina para investir por conta, geralmente rende mais aplicar o valor das parcelas e comprar à vista depois.",
  },
  {
    keywords: ["freela", "freelancer", "autonomo", "mei", "microempreendedor", "pj", "cnpj", "abrir empresa", "trabalhar por conta"],
    answer: "💼 **Finanças para autônomos/MEI**\n\n1. **Separe contas:** Pessoal e profissional, obrigatoriamente\n2. **Reserva maior:** 6-12 meses (renda variável precisa de mais segurança)\n3. **MEI:** Até R$ 81 mil/ano, impostos baixos (~R$ 70/mês)\n4. **DAS:** Pague em dia para manter benefícios (aposentadoria, auxílio-doença)\n5. **Nota fiscal:** Emita sempre para construir histórico\n\n**Cresceu além do MEI?**\n• ME (Simples Nacional): até R$ 360 mil/ano\n• Lucro presumido: para serviços com margem alta\n\n💡 Guarde **30% do faturamento** para impostos e imprevistos.",
  },
  {
    keywords: ["casal", "casamento", "financas a dois", "dividir conta", "juntar dinheiro", "namorad", "morar junto", "uniao"],
    answer: "💑 **Finanças a dois**\n\n**3 modelos comuns:**\n1. **Tudo junto:** Uma conta única. Simples, mas pode gerar conflitos\n2. **Proporcional:** Cada um contribui % da renda para despesas comuns\n3. **50/50 + individual:** Metade para casa, resto é livre\n\n**Dicas:**\n- Conversem sobre dinheiro regularmente (sem julgamento!)\n- Definam metas em comum\n- Mantenham transparência sobre dívidas\n- Cada um pode ter uma \"mesada\" livre\n\n💡 O modelo proporcional é o mais justo quando há diferença de renda.",
  },
  {
    keywords: ["filho", "bebe", "crianca", "familia", "educacao dos filhos", "faculdade", "escola"],
    answer: "👶 **Finanças com filhos**\n\n**Custos médios por mês:**\n• Fralda e higiene: R$ 200-400\n• Alimentação: R$ 300-600\n• Escola: R$ 500-3.000+\n• Saúde: R$ 200-500\n\n**Planejamento:**\n1. Monte a reserva antes do bebê nascer\n2. Revise o plano de saúde\n3. Comece a investir para a educação (Tesouro IPCA+ ou previdência)\n4. Atualize o seguro de vida\n\n💡 Investindo R$ 300/mês com 10% ao ano, em 18 anos → ~R$ 165 mil para a faculdade.",
  },
  {
    keywords: ["viagem", "viajar", "ferias", "passagem", "milha", "turismo", "mochilao"],
    answer: "✈️ **Planejando viagens com inteligência**\n\n1. **Defina orçamento total** antes de escolher o destino\n2. **Compre passagens com antecedência** (3-6 meses)\n3. **Use milhas:** Concentre gastos em um cartão com bom programa\n4. **Hospedagem:** Compare Booking, Airbnb e hostels\n5. **Moeda local:** Leve cartão de débito internacional (Wise, C6)\n6. **Seguro viagem:** Obrigatório na Europa, recomendado sempre\n\n💡 Viaje na baixa temporada — economia de 30-50%.\n\nCrie uma **meta no Lumyf** com valor e prazo!",
  },
  {
    keywords: ["carro", "automovel", "comprar carro", "financiar carro", "veiculo", "moto", "motocicleta"],
    answer: "🚗 **Comprar ou financiar carro?**\n\n**Custo real mensal de um carro:**\n• Combustível: R$ 400-800\n• Seguro: R$ 150-400\n• IPVA: ~3% do valor/ano\n• Manutenção: R$ 200-500\n• Estacionamento: R$ 200-500\n\n**Financiamento:** Juros médios de 1,5-2,5% ao mês. Um carro de R$ 50 mil pode custar R$ 80 mil+.\n\n**Alternativas:**\n• Junte e compre à vista (desconto de 10-15%)\n• Carro usado com 2-3 anos (menos depreciação)\n• Avalie se transporte público + app sai mais barato\n\n💡 Carro + custos > **20% da renda** = pesado demais!",
  },
  {
    keywords: ["casa", "imovel", "comprar casa", "apartamento", "aluguel vs compra", "financiar imovel", "comprar apartamento", "financiamento imobiliario", "fgts", "minha casa", "programa habitacional", "credito imobiliario", "taxa financiamento", "amortizar", "amortizacao", "entrada imovel", "simulacao financiamento"],
    answer: "🏠 **Financiamento imobiliário — Guia completo**\n\n**Comprar ou alugar?**\n- Alugar: melhor se precisa de mobilidade ou aluguel < 0,5% do valor do imóvel\n- Comprar: melhor se vai morar 10+ anos e tem entrada de 20%+\n\n**Tipos de financiamento:**\n- **SAC:** Parcelas decrescentes (recomendado — paga menos juros no total)\n- **PRICE:** Parcelas fixas (mais previsível, mas paga mais juros)\n- **Minha Casa Minha Vida:** Taxas subsidiadas para renda até R$ 8 mil\n\n**Taxas de juros (2024/2025):**\n- TR + 8-10% ao ano (bancos tradicionais)\n- IPCA + 4-6% ao ano (pós-fixado — risco maior)\n- Taxa fixa: 9-12% ao ano\n\n**Custos além da parcela:**\n- ITBI: 2-3% do valor do imóvel\n- Escritura e registro: 1-2%\n- Avaliação do banco: R$ 500-3.000\n- Condomínio, IPTU, manutenção\n\n**Estratégias para pagar menos:**\n1. **Entrada maior** = menos juros e parcelas menores\n2. **FGTS na entrada** e amortização anual\n3. **Amortizar pelo prazo** (reduz tempo) ou **pela parcela** (reduz valor mensal)\n4. **Portabilidade:** Troque de banco se achar taxa menor\n5. Considere **consórcio** se não tem pressa\n\n**Simulação (imóvel de R$ 300 mil, entrada 20%):**\n- Financiado: R$ 240 mil\n- 30 anos, 9% ao ano ≈ parcela inicial ~R$ 2.800 (SAC)\n- Total pago: ~R$ 530 mil (mais que o dobro!)\n\n**Regra de ouro:** Parcela < **30% da renda familiar**\n\n💡 Amortize com FGTS todo ano — pode reduzir 10+ anos do financiamento!",
  },
  {
    keywords: ["golpe", "fraude", "piramide", "esquema", "scam", "fake", "enganado", "roubaram", "clonaram"],
    answer: "🚨 **Cuidado com golpes financeiros**\n\n**Sinais de alerta:**\n- Promessas de retorno garantido acima de 2% ao mês\n- Pressão para investir rápido (\"só hoje!\")\n- Dificuldade para resgatar\n- Estrutura de pirâmide (quem indica ganha)\n\n**Golpes comuns:**\n• Pirâmides financeiras\n• Forex/cripto \"milagrosa\"\n• PIX falso / clonagem de WhatsApp\n• Links de phishing por SMS/email\n• Boletos adulterados\n\n**Se foi vítima:**\n1. Registre B.O. online\n2. Avise o banco imediatamente\n3. Conteste no Procon\n\n💡 Se parece bom demais, provavelmente é golpe!",
  },
  {
    keywords: ["doacao", "caridade", "doar", "filantropia", "ong", "ajudar"],
    answer: "❤️ **Doações inteligentes**\n\n- Defina um % fixo da renda (ex: 1-5%)\n- Doe para ONGs com transparência financeira\n- Algumas doações são dedutíveis no IR (até 6%)\n- Doações via PIX são rastreáveis\n\n💡 Doar regularmente (mesmo pouco) tem mais impacto do que doar muito uma vez.",
  },
  {
    keywords: ["etf", "indice", "ibovespa", "bova11", "ivvb11", "fundo de indice"],
    answer: "📊 **ETFs (Exchange Traded Funds)**\n\nSão fundos que replicam índices e são negociados como ações.\n\n**Populares no Brasil:**\n• **BOVA11:** Ibovespa\n• **IVVB11:** S&P 500 (EUA)\n• **HASH11:** Criptomoedas\n• **XFIX11:** Fundos imobiliários\n\n**Vantagens:**\n- Diversificação automática\n- Taxas baixas (0,2-0,5% ao ano)\n- Fácil de comprar/vender\n\n💡 ETFs são perfeitos para iniciantes que querem diversificar!",
  },
  {
    keywords: ["dividendo", "proventos", "yield", "renda passiva", "viver de renda", "independencia financeira"],
    answer: "💰 **Renda passiva com dividendos**\n\n**O que são:** Parte do lucro distribuído aos acionistas.\n\n**Como montar uma carteira:**\n1. Empresas com histórico consistente de dividendos\n2. Diversifique entre setores\n3. Reinvista os dividendos\n4. Acompanhe o **Dividend Yield** (ideal > 6% ao ano)\n\n**FIIs** pagam dividendos mensais (isentos de IR).\n\n**Quanto preciso para viver de renda?**\nRenda desejada × 300 = patrimônio necessário\nEx: R$ 5.000/mês × 300 = R$ 1.500.000\n\n💡 Para R$ 1.000/mês com yield de 8% → ~R$ 150 mil investidos.",
  },
  {
    keywords: ["dolar", "euro", "cambio", "moeda estrangeira", "comprar dolar", "remessa", "enviar dinheiro exterior"],
    answer: "💱 **Câmbio e moedas estrangeiras**\n\n**Quando comprar:**\n- Não tente acertar o melhor momento\n- Compre aos poucos (média de preço)\n- Compre com antecedência de viagens\n\n**Onde comprar:**\n• Casas de câmbio (compare preços)\n• Cartões internacionais (Wise, C6, Nomad)\n• Contas em dólar de corretoras\n\n**Para investir:**\n• ETFs internacionais (IVVB11)\n• BDRs de empresas americanas\n• Fundos cambiais\n\n💡 Ter 10-20% em ativos dolarizados protege contra desvalorização do real.",
  },
  // ─── Additional topics ────────────────────────────
  {
    keywords: ["poupanca", "caderneta", "poupanca vale a pena", "poupanca rende"],
    answer: "🐷 **Poupança: vale a pena?**\n\n**Rendimento atual:**\n• Selic > 8,5%: rende 70% da Selic + TR (~0,5% ao mês)\n• Selic ≤ 8,5%: rende 70% da Selic + TR\n\n**Vantagens:** Isenção de IR, liquidez imediata, sem risco\n**Desvantagem:** Quase sempre perde para CDB 100% CDI\n\n**Alternativas melhores:**\n• CDB com liquidez diária (100%+ CDI)\n• Tesouro Selic\n• LCI/LCA (isentas de IR!)\n\n💡 A poupança é melhor que nada, mas existem opções tão seguras que rendem mais!",
  },
  {
    keywords: ["cheque especial", "limite da conta", "conta negativa", "saldo negativo banco"],
    answer: "🚨 **Cheque especial — cuidado!**\n\nÉ um dos créditos mais caros do mercado (até 300% ao ano!).\n\n**Como sair:**\n1. Troque por empréstimo pessoal (juros menores)\n2. Peça portabilidade de dívida\n3. Reduza o limite para não cair na tentação\n\n**Prevenção:**\n• Mantenha uma reserva na conta\n• Configure alertas de saldo baixo\n• Peça ao banco para desativar o cheque especial\n\n💡 1 dia no cheque especial de R$ 1.000 pode custar R$ 0,80-1,50. Em 30 dias, R$ 25-45!",
  },
  {
    keywords: ["corretora", "qual corretora", "abrir conta corretora", "banco digital", "nubank", "inter", "c6"],
    answer: "🏦 **Escolhendo onde investir**\n\n**Corretoras populares:**\n• Rico, XP, Clear — boas para renda variável\n• Nubank, Inter, C6 — bancos digitais com investimentos\n• BTG Pactual — bom para renda fixa\n\n**O que comparar:**\n• Taxa de corretagem (muitas são zero)\n• Variedade de produtos\n• Qualidade do app/plataforma\n• Suporte ao cliente\n• Taxa de custódia\n\n💡 Você pode ter conta em mais de uma corretora! Diversificar ajuda a conseguir melhores taxas.",
  },
  {
    keywords: ["fundo de investimento", "fundo multimercado", "fundo de renda fixa", "fundo de acoes", "cota"],
    answer: "📦 **Fundos de investimento**\n\nUm gestor profissional investe seu dinheiro junto com outros cotistas.\n\n**Tipos:**\n• **Renda fixa:** Conservador, rende próximo ao CDI\n• **Multimercado:** Mix de ativos, risco moderado\n• **Ações:** Alto risco, alto potencial\n• **Cambial:** Acompanha moedas estrangeiras\n\n**Atenção às taxas:**\n• Taxa de administração: ideal < 1%/ano\n• Taxa de performance: ~20% sobre o que exceder o benchmark\n• Come-cotas: IR cobrado 2x ao ano automaticamente\n\n💡 Prefira ETFs para diversificação — taxas menores e mais transparência.",
  },
  {
    keywords: ["aluguel", "inquilino", "proprietario", "contrato de aluguel", "reajuste", "igpm"],
    answer: "🏘️ **Aluguel — dicas importantes**\n\n**Para inquilinos:**\n• Aluguel ideal: máximo 30% da renda\n• Negocie o índice de reajuste (IPCA é menor que IGP-M)\n• Leia todo o contrato antes de assinar\n• Faça vistoria detalhada com fotos\n\n**Para proprietários:**\n• Diversifique — FIIs podem ser mais rentáveis que 1 imóvel\n• Considere seguro fiança vs fiador\n• Mantenha reserva para manutenção\n\n💡 Regra geral: se o aluguel anual é < 5% do valor do imóvel, alugar é mais vantajoso que comprar.",
  },
  {
    keywords: ["heranca", "inventario", "sucessao", "testamento", "bens"],
    answer: "⚖️ **Herança e planejamento sucessório**\n\n**ITCMD:** Imposto sobre herança — varia de 4-8% por estado\n\n**Formas de planejar:**\n• Testamento: defina como dividir os bens\n• Holding familiar: protege patrimônio\n• Doação em vida: pode ter benefícios fiscais\n• Previdência (VGBL): não entra em inventário\n• Seguro de vida: vai direto ao beneficiário\n\n**Inventário:**\n• Judicial: mais demorado e caro\n• Extrajudicial: mais rápido (quando todos concordam)\n\n💡 Planeje em vida para evitar conflitos e custos altos para a família.",
  },
  {
    keywords: ["consignado", "emprestimo consignado", "margem consignavel"],
    answer: "💰 **Empréstimo consignado**\n\nDescontado direto do salário/benefício. Juros menores que empréstimo pessoal.\n\n**Cuidados:**\n• Margem máxima: 35% do salário (30% + 5% cartão)\n• Compare taxas entre bancos (variação é grande)\n• Cuidado com portabilidade — confira se é realmente melhor\n• Não use para consumo supérfluo\n\n**Quando pode valer a pena:**\n• Trocar dívida cara (cartão, cheque especial)\n• Emergência real sem reserva\n\n⚠️ Aposentados: cuidado com golpes de consignado não autorizado!",
  },
  {
    keywords: ["educacao financeira", "aprender financas", "livro financas", "curso financas", "onde aprender"],
    answer: "📚 **Educação financeira — por onde começar?**\n\n**Livros recomendados:**\n• \"Pai Rico, Pai Pobre\" — Robert Kiyosaki\n• \"Me Poupe!\" — Nathalia Arcuri\n• \"O Homem Mais Rico da Babilônia\" — George Clason\n• \"Os Segredos da Mente Milionária\" — T. Harv Eker\n\n**Canais/Podcasts:**\n• Me Poupe!, Primo Rico, Nath Finanças\n• O Primo Rico (YouTube)\n• Finanças Femininas\n\n**Conceitos essenciais:**\n1. Gaste menos do que ganha\n2. Monte reserva de emergência\n3. Invista a diferença\n4. Aprenda sobre juros compostos\n\n💡 O melhor investimento é em conhecimento!",
  },
  {
    keywords: ["salario", "quanto ganhar", "negociar salario", "aumento", "promocao", "ganhar mais"],
    answer: "💼 **Ganhando mais dinheiro**\n\n**Negociando salário:**\n1. Pesquise a faixa salarial do cargo (Glassdoor, LinkedIn)\n2. Liste suas conquistas e resultados\n3. Escolha o momento certo (após entregas importantes)\n4. Peça um valor 10-20% acima do que espera\n\n**Renda extra:**\n• Freelance na sua área\n• Aulas particulares\n• Venda de produtos/serviços\n• Cashback e programas de pontos\n• Investimentos que pagam dividendos\n\n💡 Aumentar a renda tem efeito infinito. Cortar gastos tem limite.",
  },
  {
    keywords: ["black friday", "promocao", "desconto", "compra impulsiva", "impulso", "comprar por impulso"],
    answer: "🛍️ **Comprando com inteligência**\n\n**Regras anti-impulso:**\n1. Espere 48h antes de comprar\n2. Pergunte: \"Eu PRECISO ou QUERO?\"\n3. Calcule em horas de trabalho\n4. Compare em pelo menos 3 lojas\n\n**Black Friday:**\n• Monitore preços semanas antes (Zoom, Buscapé)\n• Desconfie de descontos \"de/por\"\n• Faça lista do que realmente precisa ANTES\n• Não compre parcelado só porque \"cabe\"\n\n💡 R$ 200 de \"economia\" em algo que não precisava = R$ 200 de prejuízo!",
  },
  {
    keywords: ["assinatura", "streaming", "netflix", "spotify", "servico", "mensalidade", "cancelar"],
    answer: "📺 **Gerenciando assinaturas**\n\n**Faça uma auditoria:**\n1. Liste TODAS as assinaturas e mensalidades\n2. Marque quais realmente usa toda semana\n3. Cancele as que não usa há 30+ dias\n4. Considere planos família/compartilhados\n\n**Assinaturas comuns esquecidas:**\n• Streaming (Netflix, Spotify, Disney+...)\n• Apps premium\n• Academia que não frequenta\n• Revistas/jornais digitais\n• Nuvem/armazenamento extra\n\n💡 3 assinaturas de R$ 30 = R$ 90/mês = R$ 1.080/ano. Vale a pena?",
  },
  {
    keywords: ["supermercado", "feira", "alimentacao", "comida", "mercado", "compras do mes"],
    answer: "🛒 **Economizando no supermercado**\n\n1. **Sempre leve lista** — e siga ela!\n2. **Vá alimentado** — fome = compra por impulso\n3. **Compare preço/kg** — embalagem grande nem sempre é mais barata\n4. **Marcas próprias** — qualidade similar, preço menor\n5. **Dia de promoção** — cada mercado tem seu dia\n6. **Atacadão/atacado** — itens não-perecíveis\n7. **Frutas e verduras** — compre da estação (mais barato e fresco)\n8. **Congele** — cozinhe em lote e congele porções\n\n💡 Uma lista de compras pode reduzir seus gastos em até 30%!",
  },
  {
    keywords: ["energia", "conta de luz", "agua", "conta de agua", "economia domestica", "conta alta"],
    answer: "💡 **Economizando em contas de casa**\n\n**Energia elétrica:**\n• Bandeira vermelha? Reduza uso de ar-condicionado\n• Troque lâmpadas por LED\n• Desligue aparelhos da tomada\n• Chuveiro: 1 minuto a menos = economia no mês\n\n**Água:**\n• Banho de 5 minutos\n• Lave louça com torneira fechada\n• Reuse água da máquina para limpeza\n\n**Internet/Telefone:**\n• Negocie anualmente (ameaçe cancelar!)\n• Avalie se precisa do plano mais caro\n\n💡 Pequenas mudanças podem economizar R$ 50-100/mês em contas.",
  },
];


// ─── Chat-style Q&A (enhanced) ──────────────────────
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

  const ctx: QAContext = {
    q, raw: question, hasData, currentMonth, currentTxs, byMonth,
    categories, transactions, incomeNow, expenseNow, balanceNow,
  };

  // Run through handlers in priority order
  for (const handler of ANSWER_HANDLERS) {
    const result = handler(ctx);
    if (result !== null) return result;
  }

  // ─── Knowledge base lookup ────────────────────────
  for (const entry of KNOWLEDGE_BASE) {
    if (matchesAny(q, entry.keywords)) {
      return entry.answer;
    }
  }

  // ─── Fallback: try to be helpful ──────────────────
  return buildSmartFallback(ctx);
}

// ─── Answer handlers (ordered by priority) ──────────
const ANSWER_HANDLERS: AnswerHandler[] = [
  // Greetings
  (ctx) => {
    if (!ctx.q.match(/^(oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e ai|eai|fala|opa)/)) return null;
    if (!ctx.hasData) {
      return "Olá! 👋 Sou a Lumy, sua assistente financeira!\n\nVi que você ainda não tem transações registradas. Que tal começar? Posso te dar **dicas de organização financeira** enquanto isso. Tente perguntar:\n- **\"Me dá uma dica\"**\n- **\"Como economizar?\"**\n- **\"O que é reserva de emergência?\"**";
    }
    return `Olá! 👋 Como posso ajudar hoje?\n\nVocê tem **${ctx.currentTxs.length}** transações este mês. Posso analisar seu saldo, despesas, tendências e dar dicas personalizadas!`;
  },

  // Thanks
  (ctx) => {
    if (!ctx.q.match(/(obrigad|valeu|brigad|thanks|thank you|agradec)/)) return null;
    return "De nada! 😊 Estou sempre aqui para ajudar com suas finanças. Qualquer dúvida, é só perguntar!";
  },

  // Self-intro
  (ctx) => {
    if (!ctx.q.match(/(quem e voce|quem es tu|o que voce faz|se apresent|o que voce sabe|o que pode fazer|como funciona)/)) return null;
    return "🤖 Sou a **Lumy**, sua assistente financeira!\n\nEu analiso suas transações e te ajudo a:\n- 📊 Entender para onde seu dinheiro vai\n- 💡 Encontrar formas de economizar\n- 🎯 Alcançar suas metas financeiras\n- 📈 Acompanhar tendências de gastos\n- 📚 Aprender sobre finanças pessoais\n\nExperimente perguntar sobre investimentos, dívidas, economia, metas, câmbio, aposentadoria e muito mais!";
  },

  // ─── Data-dependent analysis ──────────────────────

  // Comparisons
  (ctx) => {
    if (!ctx.q.match(/(compar|mes passado|mes anterior|versus|vs|evoluc|tendencia|historico)/)) return null;
    if (!ctx.hasData) return "Sem dados históricos ainda. Registre transações por pelo menos 2 meses para que eu possa fazer comparações! 📊";
    const prevMk = prevMonthKey(ctx.currentMonth);
    const prevTxs = ctx.byMonth.get(prevMk) || [];
    const incomePrev = sumByType(prevTxs, "income");
    const expensePrev = sumByType(prevTxs, "expense");
    const balancePrev = incomePrev - expensePrev;

    if (prevTxs.length === 0) return `Sem dados de ${monthLabel(prevMk)} para comparar. Continue registrando para análises futuras!`;

    const expPct = expensePrev > 0 ? ((ctx.expenseNow - expensePrev) / expensePrev * 100) : 0;
    const incPct = incomePrev > 0 ? ((ctx.incomeNow - incomePrev) / incomePrev * 100) : 0;

    let lines = `📊 **Comparativo: ${monthLabel(ctx.currentMonth)} vs ${monthLabel(prevMk)}**\n\n`;
    lines += `💰 Receitas: ${formatBRL(incomePrev)} → ${formatBRL(ctx.incomeNow)} (${incPct >= 0 ? "+" : ""}${incPct.toFixed(0)}%)\n`;
    lines += `💸 Despesas: ${formatBRL(expensePrev)} → ${formatBRL(ctx.expenseNow)} (${expPct >= 0 ? "+" : ""}${expPct.toFixed(0)}%)\n`;
    lines += `📊 Saldo: ${formatBRL(balancePrev)} → ${formatBRL(ctx.balanceNow)}\n`;

    if (expPct > 15) lines += `\n⚠️ Despesas subiram ${expPct.toFixed(0)}%. Atenção!`;
    else if (expPct < -10) lines += `\n✅ Ótimo! Despesas caíram ${Math.abs(expPct).toFixed(0)}%.`;
    return lines;
  },

  // Summary
  (ctx) => {
    if (!ctx.q.match(/(resumo|relatorio|panorama|visao geral|como estou|situacao)/)) return null;
    if (!ctx.hasData) return "Ainda não tenho dados para um resumo. Comece registrando suas transações e volte aqui! 📋";
    const savingsRate = ctx.incomeNow > 0 ? ((ctx.incomeNow - ctx.expenseNow) / ctx.incomeNow * 100) : 0;
    const topCats = topCategories(ctx.currentTxs, ctx.categories, 3);
    const avg3 = avgExpenseLast(ctx.byMonth, 3);

    let summary = `📋 **Resumo financeiro — ${monthLabel(ctx.currentMonth)}**\n\n`;
    summary += `💰 Receitas: **${formatBRL(ctx.incomeNow)}**\n`;
    summary += `💸 Despesas: **${formatBRL(ctx.expenseNow)}**\n`;
    summary += `📊 Saldo: **${formatBRL(ctx.balanceNow)}**\n`;
    if (ctx.incomeNow > 0) summary += `🎯 Taxa de poupança: **${savingsRate.toFixed(0)}%**\n`;
    summary += `📝 Transações: **${ctx.currentTxs.length}**\n`;

    if (topCats.length > 0) {
      summary += `\n🏷️ **Top categorias:**\n`;
      topCats.forEach((c, i) => { summary += `${i + 1}. ${c.name} — ${formatBRL(c.total)}\n`; });
    }

    if (avg3 > 0) {
      const diff = ((ctx.expenseNow - avg3) / avg3 * 100);
      summary += `\n📈 Média 3 meses: ${formatBRL(avg3)} (${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% este mês)`;
    }

    if (savingsRate < 10 && ctx.incomeNow > 0) {
      summary += `\n\n💡 **Sugestão:** Sua poupança está baixa. Tente reduzir os gastos na sua maior categoria.`;
    } else if (savingsRate >= 20) {
      summary += `\n\n🏆 **Parabéns!** Sua taxa de poupança está excelente.`;
    }
    return summary;
  },

  // Health score
  (ctx) => {
    if (!ctx.q.match(/(nota|score|saude financeira|nota financeira|como estou indo)/)) return null;
    if (!ctx.hasData || ctx.incomeNow === 0) return "Preciso de receitas e despesas para calcular sua saúde financeira. Continue registrando! 🏥";
    let score = 50;
    const savingsRate = (ctx.incomeNow - ctx.expenseNow) / ctx.incomeNow * 100;
    if (savingsRate >= 20) score += 20;
    else if (savingsRate >= 10) score += 10;
    else if (savingsRate < 0) score -= 20;

    const avg3 = avgExpenseLast(ctx.byMonth, 3);
    if (avg3 > 0 && ctx.expenseNow <= avg3) score += 10;
    else if (avg3 > 0 && ctx.expenseNow > avg3 * 1.2) score -= 10;

    const uncatCount = ctx.currentTxs.filter((t) => t.type === "expense" && !t.category_id).length;
    if (uncatCount === 0 && ctx.currentTxs.length > 0) score += 10;
    else if (uncatCount > 5) score -= 5;
    if (ctx.currentTxs.length >= 10) score += 10;

    score = Math.max(0, Math.min(100, score));
    let emoji = "😟", label = "Precisa melhorar";
    if (score >= 80) { emoji = "🌟"; label = "Excelente!"; }
    else if (score >= 60) { emoji = "😊"; label = "Bom"; }
    else if (score >= 40) { emoji = "😐"; label = "Regular"; }

    let tips = "";
    if (savingsRate < 20) tips += "\n- Aumente a taxa de poupança para 20%+";
    if (uncatCount > 3) tips += "\n- Categorize suas transações para melhor controle";
    if (avg3 > 0 && ctx.expenseNow > avg3 * 1.1) tips += "\n- Reduza gastos para ficar dentro da sua média";

    return `${emoji} **Saúde Financeira: ${score}/100 — ${label}**\n\n📊 Taxa de poupança: ${savingsRate.toFixed(0)}%\n📝 Transações: ${ctx.currentTxs.length}\n🏷️ Sem categoria: ${uncatCount}${tips ? `\n\n💡 **Para melhorar:**${tips}` : ""}`;
  },

  // Averages
  (ctx) => {
    if (!ctx.q.match(/(media|media mensal|media de gasto|quanto gasto por mes)/)) return null;
    if (!ctx.hasData) return "Sem dados para calcular médias. Registre transações por alguns meses! 📊";
    const keys = getLastNMonths(6);
    const monthData: string[] = [];
    for (const k of keys) {
      const txs = ctx.byMonth.get(k);
      if (txs && txs.length > 0) {
        const exp = sumByType(txs, "expense");
        const inc = sumByType(txs, "income");
        monthData.push(`${monthLabel(k)}: despesas ${formatBRL(exp)} | receitas ${formatBRL(inc)}`);
      }
    }
    if (monthData.length === 0) return "Sem dados suficientes para calcular médias.";
    const avgExp = avgExpenseLast(ctx.byMonth, 6);
    return `📊 **Médias dos últimos ${monthData.length} meses:**\n\n${monthData.join("\n")}\n\n📈 Média de despesas: **${formatBRL(avgExp)}**/mês`;
  },

  // Day of week analysis
  (ctx) => {
    if (!ctx.q.match(/(dia da semana|quando gasto|dia que mais)/)) return null;
    if (!ctx.hasData || ctx.currentTxs.filter((t) => t.type === "expense").length < 3) {
      return "Preciso de mais despesas para analisar seu padrão por dia da semana. Continue registrando! 📅";
    }
    const analysis = dayOfWeekAnalysis(ctx.currentTxs);
    const dayLines = [...analysis.avgByDay.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([day, avg]) => `${day}: ${formatBRL(avg)} em média`);
    return `📅 **Análise por dia da semana**\n\n${dayLines.join("\n")}\n\n🔴 Dia mais caro: **${analysis.worstDay}**\n🟢 Dia mais econômico: **${analysis.bestDay}**`;
  },

  // Categories breakdown
  (ctx) => {
    if (!ctx.q.match(/(categoria|onde gasto|distribuic|composic)/)) return null;
    if (!ctx.hasData) return "Sem dados de categorias. Registre transações com categorias! 🏷️";
    const allCats = topCategories(ctx.currentTxs, ctx.categories, 10);
    if (allCats.length === 0) return "Nenhuma despesa categorizada este mês.";
    const lines = allCats.map((c, i) => {
      const pct = ctx.expenseNow > 0 ? (c.total / ctx.expenseNow * 100).toFixed(0) : "0";
      return `${i + 1}. ${c.name} — ${formatBRL(c.total)} (**${pct}%**)`;
    });
    return `🏷️ **Distribuição de despesas**\n\n${lines.join("\n")}\n\nTotal: **${formatBRL(ctx.expenseNow)}**`;
  },

  // Balance
  (ctx) => {
    if (!matchesAny(ctx.q, ["saldo", "sobr", "quanto tenho", "quanto falta", "quanto resta"])) return null;
    if (!ctx.hasData) return "Você ainda não tem transações registradas. Adicione na aba Transações! 📝";
    return `Seu saldo este mês é **${formatBRL(ctx.balanceNow)}** (receitas ${formatBRL(ctx.incomeNow)} - despesas ${formatBRL(ctx.expenseNow)}).`;
  },

  // Expenses
  (ctx) => {
    if (!matchesAny(ctx.q, ["despesa", "gast", "quanto gastei"])) return null;
    if (!ctx.hasData) return "Sem despesas registradas ainda. Comece adicionando seus gastos! 💸";
    const top = topCategories(ctx.currentTxs, ctx.categories, 5);
    if (top.length === 0) return "Sem despesas este mês.";
    const lines = top.map((c, i) => `${i + 1}. ${c.name} — ${formatBRL(c.total)}`).join("\n");
    return `Suas despesas este mês totalizam **${formatBRL(ctx.expenseNow)}**.\n\nPor categoria:\n${lines}`;
  },

  // Income
  (ctx) => {
    if (!matchesAny(ctx.q, ["receita", "ganho", "renda", "quanto ganhei", "salario"])) return null;
    if (!ctx.hasData) return "Nenhuma receita registrada ainda. Adicione seus ganhos! 💼";
    return `Suas receitas este mês totalizam **${formatBRL(ctx.incomeNow)}**.`;
  },

  // Savings rate
  (ctx) => {
    if (!matchesAny(ctx.q, ["economia", "economiz", "poupar", "poupanca", "taxa de poupanca", "quanto poupei"])) return null;
    if (!ctx.hasData || ctx.incomeNow === 0) return "Sem receitas registradas, não consigo calcular sua taxa de poupança. Dica: guarde **pelo menos 20%** da renda! 🐷";
    const rate = ((ctx.incomeNow - ctx.expenseNow) / ctx.incomeNow) * 100;
    const tip = rate < 20
      ? " Tente cortar gastos variáveis e automatizar a poupança no início do mês."
      : " Excelente taxa! Continue assim.";
    return `Sua taxa de poupança é **${rate.toFixed(1)}%** (${formatBRL(ctx.balanceNow)} guardados).${tip}`;
  },

  // Tips
  (ctx) => {
    if (!matchesAny(ctx.q, ["dica", "sugest", "ajuda", "me ajud", "o que faco", "o que fazer"])) return null;
    if (ctx.hasData && ctx.expenseNow > 0) {
      const topCat = topCategories(ctx.currentTxs, ctx.categories, 1);
      const savingsRate = ctx.incomeNow > 0 ? ((ctx.incomeNow - ctx.expenseNow) / ctx.incomeNow * 100) : 0;
      const personalTips: string[] = [];

      if (topCat.length > 0) {
        const catPct = (topCat[0].total / ctx.expenseNow * 100).toFixed(0);
        personalTips.push(`🎯 Sua maior categoria é ${topCat[0].name} (${catPct}%). Reduzindo 10% aqui, você economiza **${formatBRL(Math.round(topCat[0].total * 0.1))}**/mês.`);
      }
      if (savingsRate < 20 && ctx.incomeNow > 0) {
        const target = Math.round(ctx.incomeNow * 0.2);
        const extra = target - ctx.balanceNow;
        if (extra > 0) personalTips.push(`💰 Para atingir 20% de poupança, economize mais **${formatBRL(extra)}** este mês.`);
      }

      if (personalTips.length > 0) {
        return `💡 **Dicas personalizadas:**\n\n${personalTips.join("\n\n")}`;
      }
    }

    const tips = [
      "💡 **Regra 50-30-20:** 50% necessidades, 30% desejos, 20% poupança.",
      "💡 **Regra das 48h:** Antes de comprar algo não essencial, espere 48 horas.",
      "💡 **Assinaturas fantasma:** Revise seus débitos automáticos mensalmente.",
      "💡 **Pague-se primeiro:** Automatize a poupança no início do mês.",
      "💡 **Negocie anualmente:** Internet, seguro, celular — ligue e peça desconto.",
      "💡 **Envelope digital:** Separe dinheiro por categorias no início do mês.",
      "💡 **Café de casa:** R$ 8/dia = R$ 240/mês = R$ 2.880/ano!",
      "💡 **Lista de compras:** Nunca vá ao mercado sem lista — gaste até 30% menos.",
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  },

  // Largest expenses
  (ctx) => {
    if (!matchesAny(ctx.q, ["maior", "grande", "mais caro", "mais cara"])) return null;
    if (!ctx.hasData) return "Sem transações ainda. Quando começar a registrar, vou identificar os maiores gastos! 🔍";
    const expenses = ctx.currentTxs.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount);
    if (expenses.length === 0) return "Sem despesas este mês.";
    const top5 = expenses.slice(0, 5);
    const lines = top5.map((t, i) => `${i + 1}. ${t.description} — ${formatBRL(t.amount)}`).join("\n");
    return `Seus maiores gastos este mês:\n${lines}`;
  },

  // Count
  (ctx) => {
    if (!matchesAny(ctx.q, ["quantas", "total de transac", "numero de", "quantos"])) return null;
    if (!ctx.hasData) return "Você tem **0** transações registradas. Vá até Transações para começar! 📝";
    return `Você tem **${ctx.currentTxs.length}** transações este mês (${ctx.currentTxs.filter((t) => t.type === "income").length} receitas, ${ctx.currentTxs.filter((t) => t.type === "expense").length} despesas).`;
  },
];

// ─── Smart fallback ─────────────────────────────────
function buildSmartFallback(ctx: QAContext): string {
  const financeWords = [
    "dinheiro", "grana", "financ", "banco", "conta", "pagar", "cobrar",
    "preco", "valor", "custo", "barato", "caro", "comprar", "vender",
    "lucro", "prejuizo", "ganhar", "perder", "render", "aplicar",
    "parcela", "juro", "taxa", "desconto", "promocao", "oferta",
    "salario", "renda", "trabalho", "emprego", "negocio",
    "poupar", "guardar", "investir", "acao", "fundo", "bolsa",
    "cripto", "bitcoin", "tesouro", "cdb", "lci", "lca", "fii",
    "dividendo", "aposentar", "previdencia", "seguro", "imposto",
    "cartao", "credito", "debito", "emprestimo", "consignado",
    "aluguel", "imovel", "casa", "carro", "viagem", "milha",
    "inflacao", "selic", "cdi", "ipca", "cambio", "dolar", "euro",
    "score", "serasa", "cpf", "mei", "cnpj", "freelancer",
    "orcamento", "economizar", "reserva", "emergencia", "divida",
    "poupanca", "corretora", "etf", "golpe", "fraude",
    "heranca", "consorcio", "energia", "supermercado", "assinatura",
  ];

  const isFinanceRelated = financeWords.some((w) => ctx.q.includes(w));

  if (isFinanceRelated) {
    if (ctx.hasData) {
      const savingsRate = ctx.incomeNow > 0 ? ((ctx.incomeNow - ctx.expenseNow) / ctx.incomeNow * 100) : 0;
      return `Não tenho uma resposta específica para isso, mas posso te dar um panorama:\n\n📊 **Seu mês atual:**\n- Receitas: ${formatBRL(ctx.incomeNow)}\n- Despesas: ${formatBRL(ctx.expenseNow)}\n- Saldo: ${formatBRL(ctx.balanceNow)}${ctx.incomeNow > 0 ? `\n- Poupança: ${savingsRate.toFixed(0)}%` : ""}\n\nTente perguntar algo mais específico:\n• \"Resumo do mês\"\n• \"Comparar com mês passado\"\n• \"Dicas personalizadas\"`;
    }
    return "Boa pergunta! 🤔\n\nAinda não tenho dados para uma análise personalizada, mas posso te ensinar sobre vários temas:\n\n• \"Investimentos\"\n• \"Tesouro Direto\"\n• \"Reserva de emergência\"\n• \"Dívidas\"\n• \"Juros compostos\"\n• \"Score de crédito\"";
  }

  // Generic fallback — clean layout
  return `Posso te ajudar com muita coisa! 😊\n\n📊 **Análises dos seus dados:**\n• Resumo do mês\n• Comparar meses\n• Saúde financeira\n• Categorias\n• Maiores gastos\n• Média mensal\n\n💡 **Educação financeira:**\n• Investimentos\n• Tesouro Direto\n• Reserva de emergência\n• Dívidas\n• Como economizar\n• Juros compostos\n\n🏠 **Decisões de vida:**\n• Comprar casa ou carro\n• Viagem\n• Finanças a dois\n• MEI / Freelancer\n• Criptomoedas\n• Dividendos e ETFs`;
}

