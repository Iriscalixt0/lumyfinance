import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { analyzeTransactions, type LumyInsight } from "@/lib/lumy-engine";
import { streamLumyChat } from "@/lib/lumy-stream";
import { formatBRL } from "@/lib/utils/currency";
import { LumyInsights } from "@/components/lumy/LumyInsights";
import { LumyChat } from "@/components/lumy/LumyChat";

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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function buildFinancialContext(txs: Transaction[], cats: Category[]): string {
  if (txs.length === 0) return "O usuário não tem transações registradas ainda.";

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentTxs = txs.filter((t) => t.date.startsWith(currentMonth));

  const income = currentTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = currentTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const tx of currentTxs.filter((t) => t.type === "expense")) {
    const cat = cats.find((c) => c.id === tx.category_id);
    const name = cat ? `${cat.icon} ${cat.name}` : "Sem categoria";
    catMap.set(name, (catMap.get(name) || 0) + tx.amount);
  }
  const topCats = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Previous month
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const prevTxs = txs.filter((t) => t.date.startsWith(prevMonth));
  const prevExpense = prevTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const prevIncome = prevTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  let ctx = `Mês atual (${currentMonth}):
- Receitas: ${formatBRL(income)}
- Despesas: ${formatBRL(expense)}
- Saldo: ${formatBRL(balance)}
- Transações: ${currentTxs.length}
- Taxa de poupança: ${income > 0 ? ((income - expense) / income * 100).toFixed(0) : 0}%`;

  if (topCats.length > 0) {
    ctx += `\n\nTop categorias de despesa:`;
    topCats.forEach(([name, total]) => {
      ctx += `\n- ${name}: ${formatBRL(total)}`;
    });
  }

  if (prevTxs.length > 0) {
    ctx += `\n\nMês anterior (${prevMonth}):
- Receitas: ${formatBRL(prevIncome)}
- Despesas: ${formatBRL(prevExpense)}
- Saldo: ${formatBRL(prevIncome - prevExpense)}`;
  }

  // Recent transactions (last 10)
  const recent = currentTxs.slice(0, 10);
  if (recent.length > 0) {
    ctx += `\n\nÚltimas transações:`;
    recent.forEach((t) => {
      const cat = cats.find((c) => c.id === t.category_id);
      ctx += `\n- ${t.date} | ${t.type === "income" ? "+" : "-"}${formatBRL(t.amount)} | ${t.description}${cat ? ` (${cat.name})` : ""}`;
    });
  }

  ctx += `\n\nTotal de transações históricas: ${txs.length}`;
  return ctx;
}

export function LumyPage() {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? null;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<LumyInsight[]>([]);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

  const handleSend = useCallback(async (question: string) => {
    if (!question.trim() || isStreaming) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";

    // Create empty assistant message
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await streamLumyChat({
      messages: allMessages,
      financialContext: buildFinancialContext(transactions, categories),
      signal: controller.signal,
      onDelta: (chunk) => {
        assistantContent += chunk;
        const content = assistantContent;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
        );
      },
      onDone: () => {
        setIsStreaming(false);
        abortRef.current = null;
      },
      onError: (error) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ ${error}` }
              : m
          )
        );
        setIsStreaming(false);
        abortRef.current = null;
      },
    });
  }, [messages, transactions, categories, isStreaming]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LumyInsights insights={insights} />
        <LumyChat
          messages={messages}
          isStreaming={isStreaming}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
