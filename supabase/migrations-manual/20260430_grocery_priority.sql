-- ============================================================
-- Adiciona prioridade aos itens de supermercado.
-- 0 = baixa, 1 = média (default), 2 = alta
-- Rode este SQL no SQL Editor do Supabase.
-- ============================================================
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 1
  CHECK (priority BETWEEN 0 AND 2);

CREATE INDEX IF NOT EXISTS idx_grocery_items_priority
  ON public.grocery_items(workspace_id, priority DESC)
  WHERE kind = 'fixed';
