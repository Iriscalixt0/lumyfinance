import finnyWorried from "@/assets/finny-worried.png";
import finnyHappy from "@/assets/finny-happy.png";
import finnyCelebrating from "@/assets/finny-celebrating.png";
import bearMascot from "@/assets/bear-mascot.png";

export type FinnyMood = "worried" | "neutral" | "happy" | "celebrating";

export interface FinnyState {
  mood: FinnyMood;
  image: string;
  phrase: string;
  healthPercent: number;
  healthLabel: string;
  healthColor: string;
}

/**
 * Determines Finny's mood, image, phrase and financial health
 * based on user's current financial state.
 */
export function getFinnyState(params: {
  safeToSpend: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  streak: number;
  totalTx: number;
  userName: string;
}): FinnyState {
  const { safeToSpend, monthlyIncome, monthlyExpenses, streak, totalTx, userName } = params;

  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night";

  // Financial health score (0-100)
  let healthPercent = 50;
  if (monthlyIncome > 0) {
    const ratio = monthlyExpenses / monthlyIncome;
    if (ratio <= 0.5) healthPercent = 95;
    else if (ratio <= 0.7) healthPercent = 80;
    else if (ratio <= 0.9) healthPercent = 60;
    else if (ratio <= 1.0) healthPercent = 40;
    else healthPercent = Math.max(10, 30 - Math.round((ratio - 1) * 30));
  } else if (totalTx === 0) {
    healthPercent = 50; // neutral for new users
  }

  // Streak bonus
  if (streak >= 7) healthPercent = Math.min(100, healthPercent + 5);

  // Determine mood
  let mood: FinnyMood;
  if (safeToSpend < 0) mood = "worried";
  else if (healthPercent >= 80) mood = totalTx > 20 ? "celebrating" : "happy";
  else if (healthPercent >= 50) mood = "happy";
  else if (healthPercent >= 30) mood = "neutral";
  else mood = "worried";

  // Image
  const imageMap: Record<FinnyMood, string> = {
    worried: finnyWorried,
    neutral: bearMascot,
    happy: finnyHappy,
    celebrating: finnyCelebrating,
  };

  // Health label & color
  let healthLabel: string;
  let healthColor: string;
  if (healthPercent >= 80) { healthLabel = "Excelente"; healthColor = "text-emerald-400"; }
  else if (healthPercent >= 60) { healthLabel = "Boa"; healthColor = "text-primary"; }
  else if (healthPercent >= 40) { healthLabel = "Atenção"; healthColor = "text-yellow-400"; }
  else { healthLabel = "Crítica"; healthColor = "text-destructive"; }

  // Contextual phrase
  const phrase = pickPhrase({
    mood, greetingTime, safeToSpend, streak, totalTx, userName, monthlyIncome, monthlyExpenses
  });

  return {
    mood,
    image: imageMap[mood],
    phrase,
    healthPercent,
    healthLabel,
    healthColor,
  };
}

function pickPhrase(ctx: {
  mood: FinnyMood;
  greetingTime: string;
  safeToSpend: number;
  streak: number;
  totalTx: number;
  userName: string;
  monthlyIncome: number;
  monthlyExpenses: number;
}): string {
  const { mood, greetingTime, safeToSpend, streak, totalTx, userName, monthlyIncome, monthlyExpenses } = ctx;
  const pools: string[] = [];

  // Greeting layer
  if (greetingTime === "morning") pools.push(`Bom dia, ${userName}! ☀️`);
  else if (greetingTime === "afternoon") pools.push(`Boa tarde, ${userName}! 🌤️`);
  else pools.push(`Boa noite, ${userName}! 🌙`);

  // Mood-specific phrases
  switch (mood) {
    case "worried":
      pools.push(
        "Hmm… vamos com calma hoje 👀",
        "Opa, tá apertado! Vamos rever os gastos? 🔍",
        "Cuidado! Tô de olho no seu saldo 😟",
        "Respira… vamos resolver isso juntos 💪",
      );
      break;

    case "neutral":
      pools.push(
        "Tá tudo sob controle 👍",
        "Segue o plano que dá certo! 📋",
        "Tô aqui cuidando das suas finanças 🧠",
        "Bora manter o ritmo! 🎯",
      );
      break;

    case "happy":
      pools.push(
        "Mandando bem! Continue assim 💚",
        "Suas finanças tão bonitas hoje! ✨",
        "Tô orgulhoso de você! 🤩",
        "Dá pra investir um pouco, hein? 📈",
      );
      break;

    case "celebrating":
      pools.push(
        "PARABÉNS! Você tá arrasando! 🎉",
        "Que controle incrível! 🏆",
        "Mestre das finanças! 🚀",
        "Isso sim é disciplina! 🌟",
      );
      break;
  }

  // Streak phrases
  if (streak >= 7) pools.push(`${streak} dias de streak! Imbatível! 🔥`);
  else if (streak >= 3) pools.push(`${streak} dias seguidos! Tá forte! ⚡`);
  else if (streak === 0 && totalTx > 0) pools.push("Cadê o streak? Lança algo hoje! 💪");

  // Transaction milestones
  if (totalTx === 0) pools.push("Me conta seus gastos que eu cuido do resto 🎯");
  else if (totalTx >= 100) pools.push("Mais de 100 lançamentos! Você é lenda 🏆");

  // Savings suggestion
  if (safeToSpend > 0 && monthlyIncome > 0) {
    const savingsRate = ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100;
    if (savingsRate > 30) pools.push("Taxa de economia top! Investe isso! 📊");
  }

  // Pick based on time to ensure variety but consistency within the same minute
  const minute = new Date().getMinutes();
  const index = minute % pools.length;
  return pools[index];
}
