-- SaaS improvements: onboarding detail, support requests, profile preferences,
-- and dashboard summary RPC for faster workspace switching.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_intent_detail TEXT;

CREATE TABLE IF NOT EXISTS public.profile_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_consent BOOLEAN NOT NULL DEFAULT FALSE,
  location_permission_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (location_permission_state IN ('unknown', 'granted', 'denied')),
  timezone TEXT,
  locale_hint TEXT,
  country_hint TEXT,
  region_hint TEXT,
  city_hint TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profile_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile preferences" ON public.profile_preferences;
CREATE POLICY "Users can view own profile preferences"
  ON public.profile_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert own profile preferences" ON public.profile_preferences;
CREATE POLICY "Users can upsert own profile preferences"
  ON public.profile_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile preferences" ON public.profile_preferences;
CREATE POLICY "Users can update own profile preferences"
  ON public.profile_preferences
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  send_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user ON public.support_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own support requests" ON public.support_requests;
CREATE POLICY "Users can view own support requests"
  ON public.support_requests
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own support requests" ON public.support_requests;
CREATE POLICY "Users can create own support requests"
  ON public.support_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_dashboard_year_summary(
  p_workspace_id UUID,
  p_year INT
)
RETURNS TABLE (
  month_index INT,
  income_cents BIGINT,
  expense_cents BIGINT,
  investment_cents BIGINT,
  goal_cents BIGINT
) AS $$
WITH month_series AS (
  SELECT generate_series(1, 12)::INT AS month_index
),
transactions_agg AS (
  SELECT
    EXTRACT(MONTH FROM t.date)::INT AS month_index,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::BIGINT AS income_cents,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::BIGINT AS expense_cents
  FROM public.transactions t
  WHERE t.workspace_id = p_workspace_id
    AND EXTRACT(YEAR FROM t.date)::INT = p_year
  GROUP BY EXTRACT(MONTH FROM t.date)::INT
),
investments_agg AS (
  SELECT
    EXTRACT(MONTH FROM i.date)::INT AS month_index,
    COALESCE(SUM(i.amount), 0)::BIGINT AS investment_cents
  FROM public.investments i
  WHERE i.workspace_id = p_workspace_id
    AND EXTRACT(YEAR FROM i.date)::INT = p_year
  GROUP BY EXTRACT(MONTH FROM i.date)::INT
),
goals_agg AS (
  SELECT
    EXTRACT(MONTH FROM g.date)::INT AS month_index,
    COALESCE(SUM(g.amount), 0)::BIGINT AS goal_cents
  FROM public.goal_contributions g
  WHERE g.workspace_id = p_workspace_id
    AND EXTRACT(YEAR FROM g.date)::INT = p_year
  GROUP BY EXTRACT(MONTH FROM g.date)::INT
)
SELECT
  m.month_index,
  COALESCE(t.income_cents, 0)::BIGINT AS income_cents,
  COALESCE(t.expense_cents, 0)::BIGINT AS expense_cents,
  COALESCE(i.investment_cents, 0)::BIGINT AS investment_cents,
  COALESCE(g.goal_cents, 0)::BIGINT AS goal_cents
FROM month_series m
LEFT JOIN transactions_agg t ON t.month_index = m.month_index
LEFT JOIN investments_agg i ON i.month_index = m.month_index
LEFT JOIN goals_agg g ON g.month_index = m.month_index
ORDER BY m.month_index;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_dashboard_year_summary(UUID, INT) TO authenticated;
