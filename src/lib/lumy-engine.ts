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

  // Default — mais amigável e com mais opções
  return `Posso te ajudar com muita coisa! Experimente:\n\n📊 **Seus dados:**\n- \"Qual meu saldo?\"\n- \"Minhas despesas\"\n- \"Maiores gastos\"\n\n💡 **Dicas e educação:**\n- \"Como economizar?\"\n- \"O que é reserva de emergência?\"\n- \"Dicas de investimento\"\n- \"Como sair das dívidas?\"\n- \"Como organizar meu orçamento?\"\n\n🎯 **Mais:**\n- \"Como definir metas financeiras?\"\n- \"Dicas sobre cartão de crédito\"\n- \"Imposto de renda\"`;
}
