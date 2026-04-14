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

  // Health label & color — tom direto
  let healthLabel: string;
  let healthColor: string;
  if (healthPercent >= 80) { healthLabel = "Top"; healthColor = "text-emerald-400"; }
  else if (healthPercent >= 60) { healthLabel = "De boa"; healthColor = "text-primary"; }
  else if (healthPercent >= 40) { healthLabel = "Opa"; healthColor = "text-yellow-400"; }
  else { healthLabel = "Eita"; healthColor = "text-destructive"; }

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

  // Saudação curta
  if (greetingTime === "morning") pools.push(`E aí, ${userName}! ☀️`);
  else if (greetingTime === "afternoon") pools.push(`Fala, ${userName} 🤙`);
  else pools.push(`Boa noite, ${userName} 🌙`);

  // Por humor — tom direto, casual, curto
  switch (mood) {
    case "worried":
      pools.push(
        "Calma. Vamos resolver 👀",
        "Apertou. Bora rever? 🔍",
        "Tô de olho aqui 😟",
        "Respira. Tamo junto 💪",
        "Segura a onda 🌊",
      );
      break;

    case "neutral":
      pools.push(
        "Tá de boa 👍",
        "Segue o plano 📋",
        "Tô cuidando 🧠",
        "Bora manter 🎯",
        "Tá no caminho ✅",
      );
      break;

    case "happy":
      pools.push(
        "Mandou bem 💚",
        "Tá bonito isso ✨",
        "Orgulho de você 🤩",
        "Sobrou? Investe 📈",
        "Pode comemorar 🙌",
      );
      break;

    case "celebrating":
      pools.push(
        "ARRASOU! 🎉",
        "Controle absurdo 🏆",
        "Mestre 🚀",
        "Disciplina bruta 🌟",
        "Tá voando! ✈️",
      );
      break;
  }

  // Streak — curto
  if (streak >= 30) pools.push(`${streak} dias. Lenda 🔥`);
  else if (streak >= 7) pools.push(`${streak} dias! Imbatível 🔥`);
  else if (streak >= 3) pools.push(`${streak} dias seguidos ⚡`);
  else if (streak === 0 && totalTx > 0) pools.push("Cadê o streak? 💪");

  // Milestones — direto
  if (totalTx === 0) pools.push("Lança o primeiro gasto 🎯");
  else if (totalTx >= 100) pools.push("100+ lançamentos. Pro 🏆");
  else if (totalTx >= 50) pools.push("50+! Tá sério nisso 📊");

  // Economia
  if (safeToSpend > 0 && monthlyIncome > 0) {
    const savingsRate = ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100;
    if (savingsRate > 30) pools.push("Sobrando grana. Investe! 📊");
    else if (savingsRate > 15) pools.push("Guardando bem 💰");
  }

  const minute = new Date().getMinutes();
  const index = minute % pools.length;
  return pools[index];
}
