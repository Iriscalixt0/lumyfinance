/**
 * localStorage-based store for DEV preview mode.
 * Provides CRUD that mirrors Supabase's return shape so pages
 * can swap seamlessly when Supabase is unreachable.
 */

const DEV_BYPASS = import.meta.env.DEV && import.meta.env.MODE === "development";

function getStore<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Default categories for demo
const DEFAULT_CATEGORIES = [
  { id: "cat-1", name: "Alimentação", icon: "🍔", type: "expense" },
  { id: "cat-2", name: "Transporte", icon: "🚗", type: "expense" },
  { id: "cat-3", name: "Moradia", icon: "🏠", type: "expense" },
  { id: "cat-4", name: "Lazer", icon: "🎮", type: "expense" },
  { id: "cat-5", name: "Saúde", icon: "💊", type: "expense" },
  { id: "cat-6", name: "Educação", icon: "📚", type: "expense" },
  { id: "cat-7", name: "Salário", icon: "💰", type: "income" },
  { id: "cat-8", name: "Freelance", icon: "💻", type: "income" },
];

export function isDevMode() {
  return DEV_BYPASS;
}

export const devStore = {
  transactions: {
    key: "lmyf_dev_transactions",
    list(wsId: string) {
      return getStore<Record<string, unknown>>(this.key)
        .filter((t) => t.workspace_id === wsId)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    },
    insert(row: Record<string, unknown>) {
      const id = crypto.randomUUID();
      const data = { ...row, id, created_at: new Date().toISOString() };
      const all = getStore<Record<string, unknown>>(this.key);
      all.unshift(data);
      setStore(this.key, all);
      return { data, error: null };
    },
    update(id: string, changes: Record<string, unknown>) {
      const all = getStore<Record<string, unknown>>(this.key);
      const idx = all.findIndex((t) => t.id === id);
      if (idx === -1) return { error: { message: "Not found" } };
      all[idx] = { ...all[idx], ...changes };
      setStore(this.key, all);
      return { data: all[idx], error: null };
    },
    delete(id: string) {
      const all = getStore<Record<string, unknown>>(this.key).filter((t) => t.id !== id);
      setStore(this.key, all);
      return { error: null };
    },
  },

  categories: {
    key: "lmyf_dev_categories",
    list(wsId: string) {
      let cats = getStore<Record<string, unknown>>(this.key).filter((c) => c.workspace_id === wsId);
      if (cats.length === 0) {
        // Seed defaults
        cats = DEFAULT_CATEGORIES.map((c) => ({ ...c, workspace_id: wsId }));
        setStore(this.key, cats);
      }
      return cats;
    },
  },

  budgets: {
    key: "lmyf_dev_budgets",
    list(wsId: string) {
      return getStore<Record<string, unknown>>(this.key).filter((b) => b.workspace_id === wsId);
    },
  },
};
