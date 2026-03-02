-- Apenas plano Pro existe. Não há free nem business.
-- Migra workspaces existentes para plan='pro' e restringe o CHECK.

UPDATE public.workspaces SET plan = 'pro' WHERE plan IN ('free', 'business');

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_check CHECK (plan = 'pro');

ALTER TABLE public.workspaces
  ALTER COLUMN plan SET DEFAULT 'pro';
