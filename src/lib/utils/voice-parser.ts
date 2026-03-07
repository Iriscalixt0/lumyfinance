/**
 * Multilingual voice transaction NLP parser.
 * Supports: PT-BR, EN-US, ES-ES, FR-FR, DE-DE
 * Extracts: amount (including number words), description, type, date, currency, detected language.
 * No external API — pure local logic.
 */

export interface VoiceParsedTransaction {
  amount: number | null;
  description: string;
  type: "expense" | "income";
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Detected currency code */
  currency: string;
  /** Detected language */
  detectedLang: string;
  /** Original transcript */
  raw: string;
}

// ===================== LANGUAGE DETECTION =====================

const LANG_MARKERS: { lang: string; words: string[] }[] = [
  { lang: "pt-BR", words: ["gastei", "paguei", "comprei", "recebi", "ganhei", "reais", "real", "almoço", "supermercado", "mercado", "salário", "investir", "investi"] },
  { lang: "en-US", words: ["spent", "paid", "bought", "received", "earned", "dollars", "groceries", "salary", "invested", "hundred", "thousand"] },
  { lang: "es-ES", words: ["gasté", "pagué", "compré", "recibí", "gané", "euros", "supermercado", "alquiler", "sueldo", "invertí"] },
  { lang: "fr-FR", words: ["dépensé", "payé", "acheté", "reçu", "gagné", "euros", "loyer", "courses", "salaire", "investi", "j'ai"] },
  { lang: "de-DE", words: ["ausgegeben", "bezahlt", "gekauft", "erhalten", "verdient", "euro", "miete", "lebensmittel", "gehalt", "investiert", "für"] },
];

export function detectLanguage(text: string): string {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let best = "en-US";
  let bestScore = 0;
  for (const { lang, words } of LANG_MARKERS) {
    const score = words.filter(w => lower.includes(w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).length;
    if (score > bestScore) { bestScore = score; best = lang; }
  }
  return best;
}

// ===================== NUMBER WORD PARSING =====================

const NUMBER_WORDS: Record<string, Record<string, number>> = {
  "pt-BR": {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, "cinqüenta": 50,
    sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
    cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
    seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
    mil: 1000,
  },
  "en-US": {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000,
  },
  "es-ES": {
    cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    "dieciséis": 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
    veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
    cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
    seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
    mil: 1000,
  },
  "fr-FR": {
    "zéro": 0, zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
    dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
    seize: 16, "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19,
    vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
    "soixante-dix": 70, "quatre-vingts": 80, "quatre-vingt": 80, "quatre-vingt-dix": 90,
    cent: 100, "deux cents": 200, "trois cents": 300, mille: 1000,
  },
  "de-DE": {
    null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, funf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, "zwölf": 12, zwolf: 12,
    dreizehn: 13, vierzehn: 14, "fünfzehn": 15, funfzehn: 15, sechzehn: 16, siebzehn: 17,
    achtzehn: 18, neunzehn: 19,
    zwanzig: 20, "dreißig": 30, dreissig: 30, vierzig: 40, "fünfzig": 50, funfzig: 50,
    sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
    hundert: 100, tausend: 1000,
  },
};

/**
 * Parse number words from text. Handles compound forms like:
 * "vinte e cinco" (25), "twenty five" (25), "cento e cinquenta" (150)
 */
function parseNumberWords(text: string, lang: string): { value: number | null; consumed: string } {
  const words = NUMBER_WORDS[lang] || NUMBER_WORDS["en-US"];
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = lower.split(/[\s]+/);

  let total = 0;
  let current = 0;
  let found = false;
  const consumedTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Skip connectors
    if (["e", "and", "y", "et", "und"].includes(token)) {
      if (found) consumedTokens.push(token);
      continue;
    }

    // Check compound tokens (e.g., "dix-sept")
    const compound = i < tokens.length - 1 ? `${token}-${tokens[i + 1]}` : null;
    if (compound && words[compound] !== undefined) {
      current += words[compound];
      found = true;
      consumedTokens.push(tokens[i], tokens[i + 1]);
      i++;
      continue;
    }

    const val = words[token];
    if (val !== undefined) {
      found = true;
      consumedTokens.push(token);

      if (val === 1000) {
        current = (current === 0 ? 1 : current) * 1000;
        total += current;
        current = 0;
      } else if (val === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else if (val >= 100) {
        // duzentos, trezentos etc. — they are already multiples
        current += val;
      } else {
        current += val;
      }
    } else if (found) {
      // Stop when we hit a non-number word after finding numbers
      break;
    }
  }

  if (!found) return { value: null, consumed: "" };

  total += current;
  return { value: total > 0 ? total : null, consumed: consumedTokens.join(" ") };
}

// ===================== TYPE DETECTION =====================

const TYPE_KEYWORDS: Record<string, { income: string[]; expense: string[] }> = {
  "pt-BR": {
    income: ["recebi", "ganhei", "salário", "salario", "renda", "freelance", "dividendo", "pix recebido"],
    expense: ["gastei", "paguei", "comprei", "pagar", "gastar", "comprar", "investi", "investir", "apliquei"],
  },
  "en-US": {
    income: ["received", "earned", "got paid", "salary", "income"],
    expense: ["spent", "paid", "bought", "spend", "buy", "invested", "invest"],
  },
  "es-ES": {
    income: ["recibí", "recibi", "gané", "gane", "cobré", "cobre", "sueldo", "ingreso"],
    expense: ["gasté", "gaste", "pagué", "pague", "compré", "compre", "invertí", "inverti"],
  },
  "fr-FR": {
    income: ["reçu", "recu", "gagné", "gagne", "salaire", "revenu"],
    expense: ["dépensé", "depense", "payé", "paye", "acheté", "achete", "investi"],
  },
  "de-DE": {
    income: ["erhalten", "verdient", "bekommen", "gehalt", "einkommen"],
    expense: ["ausgegeben", "bezahlt", "gekauft", "investiert"],
  },
};

function detectType(text: string, lang: string): "expense" | "income" {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const kw = TYPE_KEYWORDS[lang] || TYPE_KEYWORDS["en-US"];
  if (kw.income.some(w => lower.includes(w.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) return "income";
  return "expense";
}

// ===================== CURRENCY DETECTION =====================

const CURRENCY_WORDS: Record<string, string> = {
  reais: "BRL", real: "BRL", "r$": "BRL",
  dollars: "USD", dollar: "USD", "$": "USD", bucks: "USD",
  euros: "EUR", euro: "EUR", "€": "EUR",
  pesos: "MXN",
};

const LANG_DEFAULT_CURRENCY: Record<string, string> = {
  "pt-BR": "BRL", "en-US": "USD", "es-ES": "EUR", "fr-FR": "EUR", "de-DE": "EUR",
};

function detectCurrency(text: string, lang: string): string {
  const lower = text.toLowerCase();
  for (const [word, code] of Object.entries(CURRENCY_WORDS)) {
    if (lower.includes(word)) return code;
  }
  return LANG_DEFAULT_CURRENCY[lang] || "USD";
}

// ===================== DATE EXTRACTION =====================

const DATE_WORDS: Record<string, { today: string[]; yesterday: string[]; dayBefore: string[] }> = {
  "pt-BR": { today: ["hoje"], yesterday: ["ontem"], dayBefore: ["anteontem"] },
  "en-US": { today: ["today"], yesterday: ["yesterday"], dayBefore: ["day before yesterday"] },
  "es-ES": { today: ["hoy"], yesterday: ["ayer"], dayBefore: ["anteayer"] },
  "fr-FR": { today: ["aujourd'hui", "aujourd hui", "aujourdhui"], yesterday: ["hier"], dayBefore: ["avant-hier", "avant hier"] },
  "de-DE": { today: ["heute"], yesterday: ["gestern"], dayBefore: ["vorgestern"] },
};

const WEEKDAY_MAP: Record<string, number> = {
  // PT
  domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, sabado: 6,
  // EN
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  // ES
  lunes: 1, martes: 2, "miércoles": 3, miercoles: 3, jueves: 4, viernes: 5,
  // FR
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  // DE
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6,
};

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseDate(text: string, lang: string): { date: string; cleanedText: string } {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const dw = DATE_WORDS[lang] || DATE_WORDS["en-US"];

  // Today
  for (const w of dw.today) {
    if (lower.includes(w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      return { date: toISO(new Date()), cleanedText: text.replace(new RegExp(w, "gi"), "").trim() };
    }
  }

  // Yesterday
  for (const w of dw.yesterday) {
    if (lower.includes(w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return { date: toISO(d), cleanedText: text.replace(new RegExp(w, "gi"), "").trim() };
    }
  }

  // Day before
  for (const w of dw.dayBefore) {
    const norm = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(norm)) {
      const d = new Date(); d.setDate(d.getDate() - 2);
      return { date: toISO(d), cleanedText: text.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim() };
    }
  }

  // Weekday names
  for (const [name, dayNum] of Object.entries(WEEKDAY_MAP)) {
    const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(norm)) {
      const today = new Date();
      let diff = today.getDay() - dayNum;
      if (diff <= 0) diff += 7;
      const d = new Date(); d.setDate(d.getDate() - diff);
      return { date: toISO(d), cleanedText: text.replace(new RegExp(name, "gi"), "").trim() };
    }
  }

  return { date: toISO(new Date()), cleanedText: text };
}

// ===================== AMOUNT EXTRACTION =====================

function parseAmount(text: string, lang: string): { amount: number | null; cleanedText: string } {
  const lower = text.toLowerCase();

  // Try number words first
  const wordResult = parseNumberWords(text, lang);
  if (wordResult.value && wordResult.value > 0) {
    // Check for decimals after: "cinquenta e cinco" = 55, not 50 + 5
    const cleanedText = text.replace(new RegExp(wordResult.consumed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim();
    // Remove currency words too
    const finalText = cleanedText.replace(/\b(reais|real|dollars?|euros?|pesos?|bucks?)\b/gi, "").trim();
    return { amount: wordResult.value, cleanedText: finalText };
  }

  // "mil reais", "mil euros"
  if (/\bmil\b/.test(lower)) {
    const milMatch = lower.match(/(\d+)\s*mil/);
    if (milMatch) {
      const amount = parseFloat(milMatch[1]) * 1000;
      return { amount, cleanedText: text.replace(/\d+\s*mil\s*(?:reais|real|dólares|dollars?|euros?|pesos?)?/gi, "").trim() };
    }
    return { amount: 1000, cleanedText: text.replace(/\bmil\s*(?:reais|real|dólares|dollars?|euros?|pesos?)?/gi, "").trim() };
  }

  // "mille euros" (FR)
  if (/\bmille\b/.test(lower)) {
    return { amount: 1000, cleanedText: text.replace(/\bmille\s*(?:euros?)?/gi, "").trim() };
  }

  // "tausend euro" (DE)
  if (/\btausend\b/.test(lower)) {
    return { amount: 1000, cleanedText: text.replace(/\btausend\s*(?:euro)?/gi, "").trim() };
  }

  // Currency symbol + amount
  const currencyMatch = text.match(/(?:R\$|€|\$)\s*([\d.,]+)/i);
  if (currencyMatch) {
    const amount = parseNumericAmount(currencyMatch[1]);
    if (amount) return { amount, cleanedText: text.replace(/(?:R\$|€|\$)\s*[\d.,]+/i, "").trim() };
  }

  // Amount + currency word
  const wordMatch = text.match(/([\d.,]+)\s*(?:reais|real|dólares|dollars?|euros?|pesos?|bucks?)/i);
  if (wordMatch) {
    const amount = parseNumericAmount(wordMatch[1]);
    if (amount) return { amount, cleanedText: text.replace(/[\d.,]+\s*(?:reais|real|dólares|dollars?|euros?|pesos?|bucks?)/gi, "").trim() };
  }

  // Plain number
  const numMatch = text.match(/\b(\d+[.,]?\d*)\b/);
  if (numMatch) {
    const amount = parseNumericAmount(numMatch[1]);
    if (amount) return { amount, cleanedText: text.replace(numMatch[0], "").trim() };
  }

  return { amount: null, cleanedText: text };
}

function parseNumericAmount(raw: string): number | null {
  if (/\d+\.\d{3},/.test(raw)) {
    const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    return isNaN(n) || n <= 0 ? null : n;
  }
  if (/\d+,\d{3}\./.test(raw)) {
    const n = parseFloat(raw.replace(/,/g, ""));
    return isNaN(n) || n <= 0 ? null : n;
  }
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) || n <= 0 ? null : n;
}

// ===================== DESCRIPTION CLEANING =====================

const FILLER_WORDS_ALL = /^(gastei|paguei|comprei|gastar|pagar|comprar|recebi|ganhei|investir|investi|apliquei|aplicar|spent|paid|bought|received|earned|invest|invested|gasté|gaste|pagué|pague|compré|compre|cobré|cobre|invertir|invertí|inverti|gané|gane|recibí|recibi|dépensé|depense|payé|paye|acheté|achete|reçu|recu|gagné|gagne|investi|j'ai|ausgegeben|bezahlt|gekauft|erhalten|verdient|investiert|ich\s+habe|habe|hab|em|no|na|nos|nas|de|do|da|dos|das|com|para|por|um|uma|uns|umas|o|a|os|as|on|at|in|for|the|a|an|some|en|el|la|los|las|del|con|un|una|unos|unas|por|para|pour|le|les|du|des|au|aux|dans|sur|für|im|am|dem|den|der|die|das|ein|eine|eines|einem|einen)\s+/gi;

function cleanDescription(text: string): string {
  let desc = text.trim();
  // Remove currency words leftover
  desc = desc.replace(/\b(reais|real|dólares|dollars?|euros?|pesos?|bucks?)\b/gi, "").trim();
  // Remove filler words from start
  let prev = "";
  while (prev !== desc) {
    prev = desc;
    desc = desc.replace(FILLER_WORDS_ALL, "").trim();
  }
  // Remove trailing connectors
  desc = desc.replace(/\s+(e|and|y|et|und)$/i, "").trim();
  if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  return desc;
}

// ===================== CATEGORY INFERENCE =====================

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Alimentação": ["mercado", "supermercado", "restaurante", "lanche", "ifood", "padaria", "pizza", "burger", "café", "cafe", "almoço", "almoco", "jantar", "comida", "groceries", "grocery", "food", "lunch", "dinner", "breakfast", "restaurant", "coffee", "supermarché", "supermarche", "courses", "repas", "déjeuner", "dejeuner", "dîner", "diner", "lebensmittel", "essen", "mittagessen", "abendessen", "frühstück", "fruhstuck"],
  "Transporte & Auto": ["uber", "99", "gasolina", "combustível", "combustivel", "estacionamento", "pedágio", "pedagio", "ônibus", "onibus", "metrô", "metro", "taxi", "gas", "fuel", "parking", "bus", "subway", "transport", "essence", "carburant", "péage", "peage", "benzin", "tanken", "tankstelle"],
  "Casa & Moradia": ["aluguel", "condomínio", "condominio", "iptu", "luz", "água", "agua", "gás", "internet", "energia", "rent", "electricity", "water", "utilities", "loyer", "électricité", "electricite", "eau", "miete", "strom", "wasser"],
  "Saúde & Bem-estar": ["farmácia", "farmacia", "médico", "medico", "dentista", "hospital", "remédio", "remedio", "consulta", "pharmacy", "doctor", "dentist", "medicine", "pharmacie", "médecin", "medecin", "apotheke", "arzt", "zahnarzt", "academia", "gym", "pilates", "yoga"],
  "Educação": ["curso", "escola", "faculdade", "livro", "material", "mensalidade", "course", "school", "university", "book", "tuition", "école", "ecole", "université", "universite", "livre", "schule", "universität", "universitat", "buch"],
  "Lazer & Entretenimento": ["cinema", "show", "viagem", "netflix", "spotify", "jogo", "bar", "festa", "parque", "movie", "travel", "game", "party", "park", "concert", "voyage", "film", "fête", "fete", "reise", "kino", "spiel", "party", "disney", "hbo", "streaming"],
  "Compras & Shopping": ["roupa", "calçado", "calcado", "tênis", "tenis", "camisa", "vestido", "sapato", "clothes", "shoes", "shirt", "dress", "vêtements", "vetements", "chaussures", "kleidung", "schuhe", "loja", "store", "shopping", "amazon"],
  "Investimento": ["cdb", "tesouro", "fundo", "ação", "acao", "ações", "acoes", "cripto", "bitcoin", "eth", "poupança", "poupanca", "stock", "stocks", "bond", "crypto", "savings", "aktie", "aktien", "fonds", "sparplan"],
  "Salário": ["salário", "salario", "freelance", "renda", "dividendo", "salary", "income", "freelance", "dividend", "salaire", "revenu", "gehalt", "einkommen"],
};

export function predictCategory(description: string): string | null {
  const lower = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return null;
}

// ===================== MAIN PARSER =====================

export function parseVoiceTransaction(transcript: string, hintLang?: string): VoiceParsedTransaction {
  const detected = detectLanguage(transcript);
  // If hintLang provided and detection defaulted to en-US, prefer hintLang
  const lang = hintLang && detected === "en-US" ? hintLang : detected;

  const type = detectType(transcript, lang);
  const currency = detectCurrency(transcript, lang);
  const { date, cleanedText: afterDate } = parseDate(transcript, lang);
  const { amount, cleanedText: afterAmount } = parseAmount(afterDate, lang);
  const description = cleanDescription(afterAmount);

  return { amount, description, type, date, currency, detectedLang: lang, raw: transcript };
}

// ===================== TTS CONFIRMATION =====================

const CONFIRM_TEMPLATES: Record<string, string> = {
  "pt-BR": "Registrado: {amount} em {category}. Correto?",
  "en-US": "Recorded: {amount} in {category}. Correct?",
  "es-ES": "Registrado: {amount} en {category}. ¿Correcto?",
  "fr-FR": "Enregistré: {amount} dans {category}. Correct?",
  "de-DE": "Registriert: {amount} in {category}. Korrekt?",
};

export function buildConfirmationPhrase(lang: string, amountStr: string, category: string): string {
  const template = CONFIRM_TEMPLATES[lang] || CONFIRM_TEMPLATES["en-US"];
  return template.replace("{amount}", amountStr).replace("{category}", category);
}

export const YES_WORDS = ["sim", "yes", "sí", "si", "oui", "ja", "correto", "correct", "ok"];
export const NO_WORDS = ["não", "nao", "no", "non", "nein", "cancelar", "cancel", "annuler", "abbrechen"];
