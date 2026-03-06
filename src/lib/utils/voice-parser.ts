/**
 * Parse a voice transcript like "gastei 50 reais no supermercado"
 * into { amount, description, type }.
 */
export interface VoiceParsedTransaction {
  amount: number | null;
  description: string;
  type: "expense" | "income";
}

const INCOME_KEYWORDS = ["recebi", "ganhei", "salário", "salary", "received", "earned", "ingreso", "cobré"];
const EXPENSE_KEYWORDS = ["gastei", "paguei", "comprei", "spent", "paid", "bought", "gasté", "pagué", "compré"];

export function parseVoiceTransaction(transcript: string): VoiceParsedTransaction {
  const lower = transcript.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Detect type
  const isIncome = INCOME_KEYWORDS.some(kw => lower.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  const type: "expense" | "income" = isIncome ? "income" : "expense";

  // Extract amount - patterns like "50", "50.00", "50,00", "R$ 50", "$50", "50 reais", "50 dollars"
  const amountMatch = lower.match(/(?:r\$|€|\$)?\s*(\d+[.,]?\d*)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : null;

  // Remove amount and currency words to get description
  let description = transcript
    .replace(/(?:r\$|€|\$)\s*\d+[.,]?\d*/gi, "")
    .replace(/\d+[.,]?\d*\s*(?:reais|real|dólares|dollars|euros)/gi, "")
    .replace(/\d+[.,]?\d*/g, "")
    .trim();

  // Remove leading filler words
  const fillers = /^(gastei|paguei|comprei|recebi|ganhei|spent|paid|bought|received|earned|gasté|pagué|compré|cobré|em|no|na|de|do|da|com|on|at|in|for|en|el|la|del|con)\s+/gi;
  let prev = "";
  while (prev !== description) {
    prev = description;
    description = description.replace(fillers, "").trim();
  }

  // Capitalize first letter
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return { amount, description, type };
}
