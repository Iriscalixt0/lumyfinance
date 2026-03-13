/**
 * Generic voice-to-form parsers for Goals, Budgets, and Billings.
 * Extracts amounts, descriptions, and dates from natural language.
 */

import { detectLanguage } from "./voice-parser";

// ===================== AMOUNT EXTRACTION =====================

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

function extractAmount(text: string): { amount: number | null; cleaned: string } {
  // "mil reais", "mil euros"
  const milMatch = text.match(/(\d+)\s*mil/i);
  if (milMatch) {
    return { amount: parseFloat(milMatch[1]) * 1000, cleaned: text.replace(/\d+\s*mil\s*(?:reais|real|euros?|dollars?)?/gi, "").trim() };
  }
  if (/\bmil\b/i.test(text)) {
    return { amount: 1000, cleaned: text.replace(/\bmil\s*(?:reais|real|euros?|dollars?)?/gi, "").trim() };
  }

  // Currency symbol + amount
  const currMatch = text.match(/(?:R\$|€|\$)\s*([\d.,]+)/i);
  if (currMatch) {
    const amount = parseNumericAmount(currMatch[1]);
    if (amount) return { amount, cleaned: text.replace(/(?:R\$|€|\$)\s*[\d.,]+/i, "").trim() };
  }

  // Amount + currency word
  const wordMatch = text.match(/([\d.,]+)\s*(?:reais|real|euros?|dollars?|pesos?)/i);
  if (wordMatch) {
    const amount = parseNumericAmount(wordMatch[1]);
    if (amount) return { amount, cleaned: text.replace(/[\d.,]+\s*(?:reais|real|euros?|dollars?|pesos?)/gi, "").trim() };
  }

  // Plain number
  const numMatch = text.match(/\b(\d+[.,]?\d*)\b/);
  if (numMatch) {
    const amount = parseNumericAmount(numMatch[1]);
    if (amount) return { amount, cleaned: text.replace(numMatch[0], "").trim() };
  }

  return { amount: null, cleaned: text };
}

// ===================== DATE EXTRACTION =====================

const DATE_WORDS: Record<string, { today: string[]; tomorrow: string[]; nextWeek: string[] }> = {
  "pt-BR": { today: ["hoje"], tomorrow: ["amanhã", "amanha"], nextWeek: ["semana que vem", "próxima semana", "proxima semana"] },
  "en-US": { today: ["today"], tomorrow: ["tomorrow"], nextWeek: ["next week"] },
  "es-ES": { today: ["hoy"], tomorrow: ["mañana", "manana"], nextWeek: ["próxima semana", "proxima semana"] },
  "fr-FR": { today: ["aujourd'hui", "aujourdhui"], tomorrow: ["demain"], nextWeek: ["semaine prochaine"] },
  "de-DE": { today: ["heute"], tomorrow: ["morgen"], nextWeek: ["nächste woche", "nachste woche"] },
};

function extractDate(text: string, lang: string): { date: string | null; cleaned: string } {
  const lower = text.toLowerCase();
  const dw = DATE_WORDS[lang] || DATE_WORDS["en-US"];
  const today = new Date();

  for (const w of dw.tomorrow) {
    if (lower.includes(w)) {
      const d = new Date(today); d.setDate(d.getDate() + 1);
      return { date: d.toISOString().split("T")[0], cleaned: text.replace(new RegExp(w, "gi"), "").trim() };
    }
  }

  for (const w of dw.nextWeek) {
    if (lower.includes(w)) {
      const d = new Date(today); d.setDate(d.getDate() + 7);
      return { date: d.toISOString().split("T")[0], cleaned: text.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim() };
    }
  }

  for (const w of dw.today) {
    if (lower.includes(w)) {
      return { date: today.toISOString().split("T")[0], cleaned: text.replace(new RegExp(w, "gi"), "").trim() };
    }
  }

  // Try DD/MM date pattern
  const dateMatch = text.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : today.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString().split("T")[0], cleaned: text.replace(dateMatch[0], "").trim() };
    }
  }

  return { date: null, cleaned: text };
}

// ===================== FILLER WORDS =====================

const FILLER = /^(criar|create|nueva|créer|erstellen|meta|goal|objetivo|objectif|ziel|orçamento|orcamento|budget|presupuesto|cobrança|cobranca|billing|facture|rechnung|de|para|para|for|pour|für|fur|com|with|con|avec|mit|no|na|em|do|da|dos|das|um|uma|a|o|the|un|une|el|la|les|le|der|die|das|ein|eine)\s+/gi;

function cleanDescription(text: string): string {
  let desc = text.trim();
  // Remove currency words
  desc = desc.replace(/\b(reais|real|euros?|dollars?|pesos?)\b/gi, "").trim();
  // Remove filler words from start
  let prev = "";
  while (prev !== desc) {
    prev = desc;
    desc = desc.replace(FILLER, "").trim();
  }
  // Remove trailing connectors
  desc = desc.replace(/\s+(e|and|y|et|und)$/i, "").trim();
  if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  return desc;
}

// ===================== PUBLIC PARSERS =====================

export interface VoiceGoalResult {
  title: string;
  targetAmount: number | null;
  deadline: string | null;
}

export function parseVoiceGoal(transcript: string): VoiceGoalResult {
  const lang = detectLanguage(transcript);
  const { amount, cleaned: afterAmount } = extractAmount(transcript);
  const { date, cleaned: afterDate } = extractDate(afterAmount, lang);
  const title = cleanDescription(afterDate);

  return {
    title,
    targetAmount: amount,
    deadline: date,
  };
}

export interface VoiceBudgetResult {
  category: string;
  limitAmount: number | null;
}

export function parseVoiceBudget(transcript: string): VoiceBudgetResult {
  const { amount, cleaned } = extractAmount(transcript);
  const category = cleanDescription(cleaned);

  return {
    category,
    limitAmount: amount,
  };
}

export interface VoiceBillingResult {
  description: string;
  amount: number | null;
  dueDate: string | null;
}

export function parseVoiceBilling(transcript: string): VoiceBillingResult {
  const lang = detectLanguage(transcript);
  const { amount, cleaned: afterAmount } = extractAmount(transcript);
  const { date, cleaned: afterDate } = extractDate(afterAmount, lang);
  const description = cleanDescription(afterDate);

  return {
    description,
    amount,
    dueDate: date,
  };
}
