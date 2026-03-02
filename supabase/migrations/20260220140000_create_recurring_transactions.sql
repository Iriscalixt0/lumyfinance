-- Recurring transactions
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount BIGINT NOT NULL,
  description TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: link generated transactions to recurring
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_workspace_next ON public.recurring_transactions(workspace_id, next_run_date);

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view recurring" ON public.recurring_transactions;
CREATE POLICY "Members can view recurring"
  ON public.recurring_transactions
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Writers can manage recurring" ON public.recurring_transactions;
CREATE POLICY "Writers can manage recurring"
  ON public.recurring_transactions
  FOR ALL
  USING (public.can_write(workspace_id));
