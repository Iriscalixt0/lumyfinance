interface VoiceResponseParams {
  lang: string;
  amount: number;
  category: string | null;
  monthlyTotal: number;
  budgetLimit: number | null;
  fmt: { money: (v: number) => string };
}

const TEMPLATES: Record<string, {
  saved: string;
  withBudgetOver: string;
  withBudgetUnder: string;
  withBudgetExact: string;
  nobudget: string;
}> = {
  "pt-BR": {
    saved: "Anotado!",
    withBudgetOver: "Você já gastou {total} em {category} esse mês — {over} acima do limite.",
    withBudgetUnder: "Você já gastou {total} em {category} esse mês — ainda tem {remaining} disponível.",
    withBudgetExact: "Você atingiu exatamente o limite de {category} esse mês.",
    nobudget: "Total em {category} esse mês: {total}.",
  },
  "en-US": {
    saved: "Got it!",
    withBudgetOver: "You've spent {total} on {category} this month — {over} over budget.",
    withBudgetUnder: "You've spent {total} on {category} this month — {remaining} left.",
    withBudgetExact: "You've hit exactly your {category} budget this month.",
    nobudget: "Total for {category} this month: {total}.",
  },
  "es-ES": {
    saved: "¡Anotado!",
    withBudgetOver: "Ya gastaste {total} en {category} este mes — {over} sobre el límite.",
    withBudgetUnder: "Ya gastaste {total} en {category} este mes — te quedan {remaining}.",
    withBudgetExact: "Alcanzaste exactamente el límite de {category} este mes.",
    nobudget: "Total en {category} este mes: {total}.",
  },
  "fr-FR": {
    saved: "Noté!",
    withBudgetOver: "Vous avez dépensé {total} en {category} ce mois — {over} au-dessus du budget.",
    withBudgetUnder: "Vous avez dépensé {total} en {category} ce mois — il vous reste {remaining}.",
    withBudgetExact: "Vous avez atteint exactement le budget {category} ce mois.",
    nobudget: "Total pour {category} ce mois: {total}.",
  },
  "de-DE": {
    saved: "Notiert!",
    withBudgetOver: "Sie haben {total} für {category} diesen Monat ausgegeben — {over} über dem Budget.",
    withBudgetUnder: "Sie haben {total} für {category} diesen Monat ausgegeben — noch {remaining} verfügbar.",
    withBudgetExact: "Sie haben genau das {category}-Budget diesen Monat erreicht.",
    nobudget: "Gesamt für {category} diesen Monat: {total}.",
  },
};

function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replace(`{${key}}`, val),
    template
  );
}

function normalizeLang(lang: string): string {
  const map: Record<string, string> = {
    "pt": "pt-BR", "pt-br": "pt-BR", "pt-pt": "pt-BR",
    "en": "en-US", "en-us": "en-US", "en-gb": "en-US",
    "es": "es-ES", "es-es": "es-ES",
    "fr": "fr-FR", "fr-fr": "fr-FR",
    "de": "de-DE", "de-de": "de-DE",
  };
  return map[lang.toLowerCase()] || "en-US";
}

export function buildVoiceResponse({
  lang,
  amount,
  category,
  monthlyTotal,
  budgetLimit,
  fmt,
}: VoiceResponseParams): string {
  const normalized = normalizeLang(lang);
  const t = TEMPLATES[normalized] || TEMPLATES["en-US"];
  const cat = category || "essa categoria";

  const formatForSpeech = (value: number): string => {
    return fmt.money(Math.round(value * 100));
  };

  const totalStr = formatForSpeech(monthlyTotal);
  let contextPhrase = "";

  if (budgetLimit !== null && budgetLimit > 0) {
    const diff = monthlyTotal - budgetLimit;
    if (diff > 0) {
      contextPhrase = fill(t.withBudgetOver, {
        total: totalStr,
        category: cat,
        over: formatForSpeech(diff),
      });
    } else if (diff === 0) {
      contextPhrase = fill(t.withBudgetExact, { category: cat });
    } else {
      contextPhrase = fill(t.withBudgetUnder, {
        total: totalStr,
        category: cat,
        remaining: formatForSpeech(Math.abs(diff)),
      });
    }
  } else if (monthlyTotal > 0 && category) {
    contextPhrase = fill(t.nobudget, {
      total: totalStr,
      category: cat,
    });
  }

  return contextPhrase ? `${t.saved} ${contextPhrase}` : t.saved;
}
