-- Stripe billing: plan free|pro|business, stripe_customer_id, stripe_subscription_id
-- Plans: Free (default), Pro (R$29), Business (R$79)

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_plan_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('free', 'pro', 'business'));

ALTER TABLE public.workspaces
  ALTER COLUMN plan SET DEFAULT 'free';

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;

-- Index for webhook lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_customer
  ON public.workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription
  ON public.workspaces(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Backfill: existing rows with plan='pro' keep it; new default is 'free'
-- No data change needed - the CHECK allows 'pro'
