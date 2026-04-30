import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { analyzeTransactions, type LumyInsight } from "@/lib/lumy-engine";
import { formatBRL } from "@/lib/utils/currency";
import { Bot, Send, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Info, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: "up" | "down" | null;
}

const INSIGHT_STYLES: Record<string, { icon: typeof Sparkles; color: string }> = {
  praise: { icon: TrendingUp, color: "text-emerald-500" },
  alert: { icon: AlertTriangle, color: "text-amber-500" },
  tip: { icon: Lightbulb, color: "text-primary" },
  info: { icon: Info, color: "text-blue-500" },
};

function buildFinancialContext(transactions: Transaction[], categories: Category[]): string {
  if (transactions.length === 0) return "Sem transações registradas ainda.";

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

  const thisMonth = transactions.filter((t) => t.date.startsWith(currentMonth));
  const lastMonth = transactions.filter((t) => t.date.startsWith(prevMonth));

  const sum = (txs: Transaction[], type: string) =>
    txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

  const income = sum(thisMonth, "income");
  const expenses = sum(thisMonth, "expense");
  const balance = income - expenses;
  const lastIncome = sum(lastMonth, "income");
  const lastExpenses = sum(lastMonth, "expense");

  // Category breakdown this month
  const catMap = new Map<string, number>();
  for (const tx of thisMonth.filter((t) => t.type === "expense")) {
    const cat = categories.find((c) => c.id === tx.category_id);
    const name = cat ? `${cat.icon} ${cat.name}` : "Sem categoria";
    catMap.set(name, (catMap.get(name) || 0) + tx.amount);
  }
  const topCats = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amt]) => `  - ${name}: ${formatBRL(amt)}`)
    .join("\n");

  // Recent transactions (last 10)
  const recent = transactions
    .slice(0, 10)
    .map((t) => {
      const cat = categories.find((c) => c.id === t.category_id);
      const catName = cat ? cat.name : "sem categoria";
      return `  - ${t.date}: ${t.type === "income" ? "+" : "-"}${formatBRL(t.amount)} — ${t.description} (${catName})`;
    })
    .join("\n");

  return [
    `MÊS ATUAL (${currentMonth}):`,
    `  Receitas: ${formatBRL(income)}`,
    `  Despesas: ${formatBRL(expenses)}`,
    `  Saldo: ${formatBRL(balance)}`,
    ``,
    `MÊS ANTERIOR (${prevMonth}):`,
    `  Receitas: ${formatBRL(lastIncome)}`,
    `  Despesas: ${formatBRL(lastExpenses)}`,
    ``,
    `TOP CATEGORIAS (mês atual):`,
    topCats || "  Sem despesas categorizadas",
    ``,
    `ÚLTIMAS 10 TRANSAÇÕES:`,
    recent,
    ``,
    `TOTAL DE TRANSAÇÕES NO HISTÓRICO: ${transactions.length}`,
  ].join("\n");
}

export function LumyPage() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<LumyInsight[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      if (!wsId) { setLoading(false); return; }
      const [txRes, catRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("workspace_id", wsId).order("date", { ascending: false }),
        supabase.from("categories").select("id, name, icon, type").eq("workspace_id", wsId),
      ]);
      const txs = txRes.data ?? [];
      const cats = catRes.data ?? [];
      setTransactions(txs);
      setCategories(cats);
      setInsights(analyzeTransactions(txs, cats));
      setLoading(false);
    }
    load();
  }, [wsId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(question: string) {
    if (!question.trim() || sending) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const context = buildFinancialContext(transactions, categories);
      const { data, error } = await supabase.functions.invoke("lumy-chat", {
        body: { message: question, context },
      });

      if (error) throw new Error(error.message);

      const reply = data?.reply ?? "Desculpe, não consegui processar sua mensagem. Tente novamente.";
      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ Não consegui me conectar ao servidor. Verifique sua conexão e tente novamente.\n\n_Detalhe: ${errMsg}_`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setSending(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input.trim());
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lumy</h1>
          <p className="text-sm text-muted-foreground">Seu assistente financeiro inteligente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Insights (rule-based, always available) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Análises automáticas</h2>
          </div>

          {insights.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Sem dados suficientes para análise.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight) => {
                const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
                const Icon = style.icon;
                return (
                  <div key={insight.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${style.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{insight.icon} {insight.title}</p>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{insight.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Chat (Gemini LLM) */}
        <div className="bg-card border border-border rounded-2xl flex flex-col h-[600px]">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Pergunte à Lumy
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">IA com seus dados financeiros reais</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground mb-4">Olá! Sou a Lumy 👋<br />Pergunte qualquer coisa sobre suas finanças.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Resumo do mês",
                    "Onde estou gastando mais?",
                    "Comparar com mês passado",
                    "Como economizar?",
                    "Saúde financeira",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={sending}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return <strong key={i}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, feedback: m.feedback === "up" ? null : "up" } : m))}
                        className={`p-1 rounded-lg transition-colors ${msg.feedback === "up" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        aria-label="Resposta útil"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, feedback: m.feedback === "down" ? null : "down" } : m))}
                        className={`p-1 rounded-lg transition-colors ${msg.feedback === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        aria-label="Resposta não útil"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Lumy está pensando...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="px-5 py-4 border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre suas finanças..."
              disabled={sending}
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
