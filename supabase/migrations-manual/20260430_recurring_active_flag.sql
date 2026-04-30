-- ============================================================
-- Adiciona o flag `active` em recurring_transactions
-- Rode este SQL no SQL Editor do seu Supabase.
-- ============================================================
ALTER TABLE public.recurring_transactions
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_recurring_workspace_active
  ON public.recurring_transactions(workspace_id, active);
