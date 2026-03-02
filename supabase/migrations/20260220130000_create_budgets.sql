-- Budgets: orçamento por categoria por mês
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  limit_amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, category_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_workspace_year_month ON public.budgets(workspace_id, year, month);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view budgets" ON public.budgets;
CREATE POLICY "Members can view budgets"
  ON public.budgets
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Writers can manage budgets" ON public.budgets;
CREATE POLICY "Writers can manage budgets"
  ON public.budgets
  FOR ALL
  USING (public.can_write(workspace_id));
