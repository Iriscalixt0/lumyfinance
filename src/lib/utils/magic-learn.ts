/**
 * Local learning engine for auto-categorization.
 * Stores user corrections in localStorage so that repeated corrections
 * automatically learn the user's preference.
 */

const STORAGE_KEY = "lumyf-magic-rules";
const LEARN_THRESHOLD = 3; // corrections needed before auto-learning

interface CorrectionEntry {
  term: string;
  category: string;
  count: number;
}

interface LearnedRules {
  corrections: CorrectionEntry[];
  rules: Record<string, string>; // term → category (learned after threshold)
}

function loadRules(): LearnedRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { corrections: [], rules: {} };
}

function saveRules(data: LearnedRules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Record a user correction. If the same term→category pair is corrected
 * LEARN_THRESHOLD times, save it as an automatic rule.
 */
export function recordCorrection(term: string, category: string): boolean {
  const normalized = term.toLowerCase().trim();
  if (!normalized || !category) return false;

  const data = loadRules();

  const existing = data.corrections.find(
    (c) => c.term === normalized && c.category === category
  );

  if (existing) {
    existing.count++;
    if (existing.count >= LEARN_THRESHOLD) {
      data.rules[normalized] = category;
      // Remove from corrections since it's now a rule
      data.corrections = data.corrections.filter(
        (c) => !(c.term === normalized && c.category === category)
      );
    }
  } else {
    data.corrections.push({ term: normalized, category, count: 1 });
  }

  saveRules(data);
  return existing ? existing.count >= LEARN_THRESHOLD : false;
}

/**
 * Check if there's a learned rule for a given description.
 * Returns the learned category or null.
 */
export function getLearnedCategory(description: string): string | null {
  const normalized = description.toLowerCase().trim();
  if (!normalized) return null;

  const data = loadRules();

  // Exact match first
  if (data.rules[normalized]) return data.rules[normalized];

  // Partial match — check if any rule term is contained in the description
  for (const [term, category] of Object.entries(data.rules)) {
    if (normalized.includes(term)) return category;
  }

  return null;
}

/**
 * Get all learned rules (for display in settings).
 */
export function getAllLearnedRules(): Record<string, string> {
  return loadRules().rules;
}

/**
 * Clear all learned rules.
 */
export function clearLearnedRules() {
  localStorage.removeItem(STORAGE_KEY);
}
