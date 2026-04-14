import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "@/lib/i18n";

interface BearSpeechBubbleProps {
  safeToSpend: number;
  streak: number;
  totalTx: number;
  userName: string;
}

export function BearSpeechBubble({ safeToSpend, streak, totalTx, userName }: BearSpeechBubbleProps) {
  const t = useTranslations("dashboard");
  const [show, setShow] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const phrases = useMemo(() => {
    const hour = new Date().getHours();
    const list: string[] = [];

    // Greeting-based
    if (hour < 12) list.push(`Bom dia, ${userName}! ☀️ Bora cuidar da grana?`);
    else if (hour < 18) list.push(`Boa tarde! 🌤️ Como estão os gastos hoje?`);
    else list.push(`Boa noite! 🌙 Hora de fechar o dia.`);

    // Financial state
    if (safeToSpend > 0) {
      list.push(`Você ainda pode gastar com tranquilidade! 💚`);
      if (safeToSpend > 5000_00) list.push(`Tá sobrando bem! Que tal investir? 📈`);
    } else if (safeToSpend < 0) {
      list.push(`Opa, tá no vermelho! 🔴 Vamos rever os gastos?`);
    } else {
      list.push(`Zerado! Cuidado com os próximos gastos 😬`);
    }

    // Streak
    if (streak >= 7) list.push(`${streak} dias de streak! Você é fera! 🔥`);
    else if (streak >= 3) list.push(`${streak} dias seguidos! Continua assim! ⚡`);
    else if (streak === 0 && totalTx > 0) list.push(`Cadê o streak? Lança algo hoje! 💪`);

    // Transactions
    if (totalTx === 0) list.push(`Adicione sua primeira transação! 🎯`);
    else if (totalTx >= 50) list.push(`Mais de ${totalTx} lançamentos! Você é pro! 🏆`);
    else if (totalTx >= 10) list.push(`${totalTx} transações! Tá no caminho certo 📊`);

    // Motivational
    list.push(`Cada real anotado é um passo pro controle 🧠`);

    return list;
  }, [safeToSpend, streak, totalTx, userName]);

  // Animate in after mount
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Rotate phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <div
      className={`absolute -top-2 left-28 sm:left-36 z-10 transition-all duration-500 ${
        show ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
      }`}
    >
      <div className="relative bg-white/95 dark:bg-white/15 backdrop-blur-md rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-lg max-w-[200px] sm:max-w-[240px] border border-white/20">
        <p className="text-[11px] sm:text-xs font-semibold text-foreground leading-snug animate-fade-in" key={phraseIndex}>
          {phrases[phraseIndex]}
        </p>
        {/* Triangle pointer */}
        <div className="absolute -bottom-1.5 left-3 w-3 h-3 bg-white/95 dark:bg-white/15 rotate-45 border-b border-r border-white/20" />
      </div>
    </div>
  );
}
