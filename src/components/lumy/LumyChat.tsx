import { useState, useEffect, useRef } from "react";
import { Bot, Send, Square } from "lucide-react";
import type { ChatMessage } from "@/pages/LumyPage";

interface LumyChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
}

const QUICK_QUESTIONS = [
  "Resumo do mês",
  "Comparar com mês passado",
  "Saúde financeira",
  "Dicas personalizadas",
  "Como economizar?",
  "O que é reserva de emergência?",
];

function renderMarkdown(content: string) {
  return content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function LumyChat({ messages, isStreaming, onSend, onStop }: LumyChatProps) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    onSend(q);
  }

  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col h-[600px]">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Pergunte à Lumy
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">IA</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pergunte qualquer coisa sobre finanças — a Lumy agora usa IA para responder
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground mb-4">Olá! Sou a Lumy 👋</p>
            <p className="text-xs text-muted-foreground mb-4">
              Agora com IA! Pergunte qualquer coisa sobre suas finanças ou educação financeira.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  disabled={isStreaming}
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
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" && isStreaming ? (
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : (
                renderMarkdown(msg.content)
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-border flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte qualquer coisa sobre finanças..."
          disabled={isStreaming}
          className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}
