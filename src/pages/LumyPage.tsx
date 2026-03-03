import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { analyzeTransactions, answerQuestion, type LumyInsight } from "@/lib/lumy-engine";
import { Bot, Send, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Info } from "lucide-react";

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
}

const INSIGHT_STYLES: Record<string, { icon: typeof Sparkles; color: string }> = {
  praise: { icon: TrendingUp, color: "text-emerald-500" },
  alert: { icon: AlertTriangle, color: "text-amber-500" },
  tip: { icon: Lightbulb, color: "text-primary" },
  info: { icon: Info, color: "text-blue-500" },
};

export function LumyPage() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<LumyInsight[]>([]);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
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

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q };
    const answer = answerQuestion(q, transactions, categories);
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: answer };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
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
        {/* Left: Insights */}
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

        {/* Right: Chat */}
        <div className="bg-card border border-border rounded-2xl flex flex-col h-[600px]">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Pergunte à Lumy
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pergunte sobre saldo, despesas, dicas e mais</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground mb-4">Olá! Sou a Lumy 👋</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Qual meu saldo?", "Minhas despesas", "Dicas de economia", "Maiores gastos"].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q };
                        const answer = answerQuestion(q, transactions, categories);
                        const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: answer };
                        setMessages((prev) => [...prev, userMsg, assistantMsg]);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
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
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="px-5 py-4 border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre suas finanças..."
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
