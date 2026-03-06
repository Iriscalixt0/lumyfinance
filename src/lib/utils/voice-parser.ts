/**
 * Advanced voice transaction parser.
 * Extracts: amount, description, type (expense/income/investment), date, and raw transcript.
 * Supports PT-BR, EN, ES naturally spoken sentences.
 *
 * Examples:
 *   "gastei 50 reais no mercado hoje"
 *   "investir 20 em CDB hoje"
 *   "recebi 3000 de salário ontem"
 *   "I spent 30 dollars on groceries yesterday"
 *   "gasté 100 pesos en el super"
 */

export interface VoiceParsedTransaction {
  amount: number | null;
  description: string;
  type: "expense" | "income";
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Original transcript for confirmation */
  raw: string;
}

// ---- Type detection ----
const INCOME_KW = [
  "recebi", "ganhei", "salário", "salario", "renda", "freelance", "dividendo",
  "received", "earned", "salary", "income", "got paid",
  "cobré", "ingreso", "gané", "sueldo",
];
const INVESTMENT_KW = [
  "investir", "investi", "apliquei", "aplicar", "cdb", "tesouro", "fundo", "ação", "ações", "cripto", "bitcoin", "eth",
  "invest", "invested",
  "invertir", "invertí",
];
const EXPENSE_KW = [
  "gastei", "paguei", "comprei", "pagar", "gastar", "comprar",
  "spent", "paid", "bought", "spend", "buy",
  "gasté", "pagué", "compré", "gastar", "comprar",
];

function detectType(lower: string): "expense" | "income" {
  if (INCOME_KW.some(kw => lower.includes(kw))) return "income";
  // Investments are treated as expense (money going out)
  // but description will contain the investment name
  return "expense";
}

// ---- Date extraction ----
const DATE_PATTERNS: { pattern: RegExp; resolve: () => string }[] = [
  {
    pattern: /\b(hoje|today|hoy)\b/i,
    resolve: () => toISO(new Date()),
  },
  {
    pattern: /\b(ontem|yesterday|ayer)\b/i,
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return toISO(d);
    },
  },
  {
    pattern: /\b(anteontem|anteayer|day before yesterday)\b/i,
    resolve: () => {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      return toISO(d);
    },
  },
  {
    // "segunda", "terça", etc. → last occurrence of that weekday
    pattern: /\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|domingo)\b/i,
    resolve: function () {
      // This is a placeholder — we use the match in parseDate
      return toISO(new Date());
    },
  },
];

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0, sunday: 0,
  segunda: 1, monday: 1, lunes: 1,
  "terça": 1, terca: 2, tuesday: 2, martes: 2,
  quarta: 3, wednesday: 3, "miércoles": 3, miercoles: 3,
  quinta: 4, thursday: 4, jueves: 4,
  sexta: 5, friday: 5, viernes: 5,
  "sábado": 6, sabado: 6, saturday: 6,
};

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseDate(text: string): { date: string; cleanedText: string } {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let date = toISO(new Date()); // default to today

  // Check "hoje/today/hoy"
  if (/\b(hoje|today|hoy)\b/i.test(lower)) {
    date = toISO(new Date());
    return { date, cleanedText: text.replace(/\b(hoje|today|hoy)\b/gi, "").trim() };
  }

  // Check "ontem/yesterday/ayer"
  if (/\b(ontem|yesterday|ayer)\b/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = toISO(d);
    return { date, cleanedText: text.replace(/\b(ontem|yesterday|ayer)\b/gi, "").trim() };
  }

  // Check "anteontem"
  if (/\b(anteontem|anteayer|day before yesterday)\b/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    date = toISO(d);
    return { date, cleanedText: text.replace(/\b(anteontem|anteayer|day before yesterday)\b/gi, "").trim() };
  }

  // Check weekday names → last occurrence
  for (const [name, dayNum] of Object.entries(WEEKDAY_MAP)) {
    const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(norm)) {
      const today = new Date();
      const todayDay = today.getDay();
      let diff = todayDay - dayNum;
      if (diff <= 0) diff += 7;
      const d = new Date();
      d.setDate(d.getDate() - diff);
      date = toISO(d);
      const regex = new RegExp(`\\b${name}\\b`, "gi");
      return { date, cleanedText: text.replace(regex, "").trim() };
    }
  }

  return { date, cleanedText: text };
}

// ---- Amount extraction ----
function parseAmount(text: string): { amount: number | null; cleanedText: string } {
  // Match patterns: "R$ 50", "$50", "€50", "50 reais", "50.00", "50,50", "1500", "1.500,00"
  // Also handle "mil" = 1000
  const lower = text.toLowerCase();

  // "mil reais", "mil dólares" etc
  if (/\bmil\b/.test(lower)) {
    const milMatch = lower.match(/(\d+)\s*mil/);
    if (milMatch) {
      const amount = parseFloat(milMatch[1]) * 1000;
      return { amount, cleanedText: text.replace(/\d+\s*mil\s*(?:reais|real|dólares|dollars|euros|pesos)?/gi, "").trim() };
    }
    // just "mil" = 1000
    return { amount: 1000, cleanedText: text.replace(/\bmil\s*(?:reais|real|dólares|dollars|euros|pesos)?/gi, "").trim() };
  }

  // Currency symbol + amount: "R$ 1.500,00" or "$1,500.00"
  const currencyMatch = text.match(/(?:R\$|€|\$)\s*([\d.,]+)/i);
  if (currencyMatch) {
    const raw = currencyMatch[1];
    const amount = parseNumericAmount(raw);
    if (amount) {
      return { amount, cleanedText: text.replace(/(?:R\$|€|\$)\s*[\d.,]+/i, "").trim() };
    }
  }

  // Amount + currency word: "50 reais", "100 dollars"
  const wordMatch = text.match(/([\d.,]+)\s*(?:reais|real|dólares|dollars|euros|pesos)/i);
  if (wordMatch) {
    const amount = parseNumericAmount(wordMatch[1]);
    if (amount) {
      return { amount, cleanedText: text.replace(/[\d.,]+\s*(?:reais|real|dólares|dollars|euros|pesos)/gi, "").trim() };
    }
  }

  // Plain number
  const numMatch = text.match(/\b(\d+[.,]?\d*)\b/);
  if (numMatch) {
    const amount = parseNumericAmount(numMatch[1]);
    if (amount) {
      return { amount, cleanedText: text.replace(numMatch[0], "").trim() };
    }
  }

  return { amount: null, cleanedText: text };
}

function parseNumericAmount(raw: string): number | null {
  // Detect format: "1.500,00" (BR) vs "1,500.00" (US)
  if (/\d+\.\d{3},/.test(raw)) {
    // BR format: 1.500,00
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normalized);
    return isNaN(n) || n <= 0 ? null : n;
  }
  if (/\d+,\d{3}\./.test(raw)) {
    // US format: 1,500.00
    const normalized = raw.replace(/,/g, "");
    const n = parseFloat(normalized);
    return isNaN(n) || n <= 0 ? null : n;
  }
  // Simple: "50" or "50,50" or "50.50"
  const normalized = raw.replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) || n <= 0 ? null : n;
}

// ---- Description cleaning ----
const FILLER_WORDS = /^(gastei|paguei|comprei|gastar|pagar|comprar|recebi|ganhei|investir|investi|apliquei|aplicar|spent|paid|bought|received|earned|invest|invested|gasté|pagué|compré|cobré|invertir|invertí|gané|em|no|na|nos|nas|de|do|da|dos|das|com|para|por|um|uma|uns|umas|o|a|os|as|on|at|in|for|the|a|an|some|en|el|la|los|las|del|con|un|una|unos|unas|por|para)\s+/gi;

function cleanDescription(text: string): string {
  let desc = text.trim();
  // Remove filler words from start
  let prev = "";
  while (prev !== desc) {
    prev = desc;
    desc = desc.replace(FILLER_WORDS, "").trim();
  }
  // Capitalize first letter
  if (desc) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  return desc;
}

// ---- Main parser ----
export function parseVoiceTransaction(transcript: string): VoiceParsedTransaction {
  const lower = transcript.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const type = detectType(lower);

  // 1. Extract date
  const { date, cleanedText: afterDate } = parseDate(transcript);

  // 2. Extract amount
  const { amount, cleanedText: afterAmount } = parseAmount(afterDate);

  // 3. Clean description
  const description = cleanDescription(afterAmount);

  return {
    amount,
    description,
    type,
    date,
    raw: transcript,
  };
}
