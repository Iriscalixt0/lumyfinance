-- ============================================================
-- LUMY FINANCE — SECURITY PATCH (RLS completo + tabelas faltantes)
-- ============================================================
-- Rode este script DEPOIS do supabase/setup-database.sql.
-- É idempotente: pode rodar várias vezes sem quebrar nada.
-- Cole inteiro no SQL Editor do Supabase e clique em Run.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- 0) Helpers extras (idempotentes)
-- ----------------------------------------------------------------
-- Já existem em setup-database.sql, mas garantimos search_path travado.
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role IN ('owner', 'admin', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role IN ('owner', 'admin')
  );
$$;

-- ----------------------------------------------------------------
-- 1) Tabelas faltantes (frontend usa, mas o setup base não cria)
-- ----------------------------------------------------------------

-- 1.1) Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budgets_workspace ON public.budgets(workspace_id);

-- 1.2) Recurring transactions
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount BIGINT NOT NULL,
  description TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  next_run DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_workspace ON public.recurring_transactions(workspace_id, next_run);

-- 1.3) Billings (contas a pagar/receber)
CREATE TABLE IF NOT EXISTS public.billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('payable','receivable')),
  amount BIGINT NOT NULL,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','canceled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billings_workspace_due ON public.billings(workspace_id, due_date);

-- 1.4) Crypto holdings
CREATE TABLE IF NOT EXISTS public.crypto_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  amount NUMERIC(28,12) NOT NULL,
  avg_buy_price BIGINT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crypto_workspace ON public.crypto_holdings(workspace_id);

-- 1.5) Notifications (PRIVADO por usuário)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- 1.6) Receipts (PRIVADO: só quem subiu)
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipts_uploader ON public.receipts(uploaded_by);

-- 1.7) Scanned receipts (PRIVADO: só quem subiu)
CREATE TABLE IF NOT EXISTS public.scanned_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  raw_text TEXT,
  parsed JSONB,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scanned_receipts_uploader ON public.scanned_receipts(uploaded_by);

-- 1.8) User achievements (PRIVADO por usuário)
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- 1.9) User streaks (PRIVADO por usuário)
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.10) Workspace invites
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','viewer')),
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_workspace ON public.workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.workspace_invites(lower(email));

-- ----------------------------------------------------------------
-- 2) Ativa RLS em TODAS as tabelas (idempotente)
-- ----------------------------------------------------------------
ALTER TABLE public.budgets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_holdings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_receipts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites      ENABLE ROW LEVEL SECURITY;

-- (Re-afirma RLS nas existentes — não custa)
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions  ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 3) Reforço de policies nas tabelas EXISTENTES (gaps fechados)
-- ----------------------------------------------------------------

-- workspaces: INSERT/DELETE só pelo dono
DROP POLICY IF EXISTS "Owner can insert workspace" ON public.workspaces;
CREATE POLICY "Owner can insert workspace" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner can delete workspace" ON public.workspaces;
CREATE POLICY "Owner can delete workspace" ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- workspace_members: troca o "FOR ALL" sem WITH CHECK por policies por operação
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can insert members" ON public.workspace_members;
CREATE POLICY "Admins can insert members" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
CREATE POLICY "Admins can update members" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Admins can delete members" ON public.workspace_members;
CREATE POLICY "Admins can delete members" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id) AND role <> 'owner');

-- transactions: adiciona WITH CHECK em UPDATE pra impedir mover linha entre workspaces
DROP POLICY IF EXISTS "Writers can update transactions" ON public.transactions;
CREATE POLICY "Writers can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id));

-- categories / accounts / investments / goals / goal_contributions: substitui FOR ALL por com WITH CHECK
DROP POLICY IF EXISTS "Writers can manage categories" ON public.categories;
CREATE POLICY "Writers can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id));

DROP POLICY IF EXISTS "Writers can manage accounts" ON public.accounts;
CREATE POLICY "Writers can manage accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id));

DROP POLICY IF EXISTS "Writers can manage investments" ON public.investments;
CREATE POLICY "Writers can manage investments" ON public.investments
  FOR ALL TO authenticated
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id));

DROP POLICY IF EXISTS "Writers can manage goals" ON public.goals;
CREATE POLICY "Writers can manage goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id));

DROP POLICY IF EXISTS "Writers can manage goal_contributions" ON public.goal_contributions;
CREATE POLICY "Writers can manage goal_contributions" ON public.goal_contributions
  FOR ALL TO authenticated
  USING (public.can_write(workspace_id))
  WITH CHECK (public.can_write(workspace_id));

-- ----------------------------------------------------------------
-- 4) Policies para as TABELAS NOVAS
-- ----------------------------------------------------------------

-- 4.1) Budgets, recurring_transactions, billings, crypto_holdings → escopo workspace
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['budgets','recurring_transactions','billings','crypto_holdings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s', t);
    EXECUTE format($p$CREATE POLICY "%1$s_select" ON public.%1$s
      FOR SELECT TO authenticated
      USING (public.is_workspace_member(workspace_id))$p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s_write" ON public.%1$s', t);
    EXECUTE format($p$CREATE POLICY "%1$s_write" ON public.%1$s
      FOR ALL TO authenticated
      USING (public.can_write(workspace_id))
      WITH CHECK (public.can_write(workspace_id))$p$, t);
  END LOOP;
END
$$;

-- 4.2) Notifications → SÓ o próprio usuário
DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;
CREATE POLICY "notifications_owner_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- INSERT em notifications: apenas o próprio user pode criar para si
DROP POLICY IF EXISTS "notifications_self_insert" ON public.notifications;
CREATE POLICY "notifications_self_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4.3) Receipts e scanned_receipts → SÓ quem subiu
DROP POLICY IF EXISTS "receipts_owner_all" ON public.receipts;
CREATE POLICY "receipts_owner_all" ON public.receipts
  FOR ALL TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid() AND public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "scanned_receipts_owner_all" ON public.scanned_receipts;
CREATE POLICY "scanned_receipts_owner_all" ON public.scanned_receipts
  FOR ALL TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid() AND public.is_workspace_member(workspace_id));

-- 4.4) User achievements e streaks → SÓ o próprio usuário
DROP POLICY IF EXISTS "achievements_owner_select" ON public.user_achievements;
CREATE POLICY "achievements_owner_select" ON public.user_achievements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "achievements_owner_insert" ON public.user_achievements;
CREATE POLICY "achievements_owner_insert" ON public.user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "streaks_owner_all" ON public.user_streaks;
CREATE POLICY "streaks_owner_all" ON public.user_streaks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4.5) Workspace invites → admins do workspace + convidado pode ver/aceitar pelo email
DROP POLICY IF EXISTS "invites_admin_all" ON public.workspace_invites;
CREATE POLICY "invites_admin_all" ON public.workspace_invites
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "invites_invitee_can_view" ON public.workspace_invites;
CREATE POLICY "invites_invitee_can_view" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ----------------------------------------------------------------
-- 5) Hardening final: revoga acesso direto às tabelas para roles públicos
-- ----------------------------------------------------------------
-- Garante que nenhum role anon/authenticated tem permissão direta além do que RLS permite.
-- (PostgREST/Supabase usa GRANT por padrão; RLS é a barreira real, mas reforçamos.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Tabelas públicas onde anon NÃO deve ler nada (default deny via RLS já cobre,
-- mas removemos GRANT pra evitar surpresas).
-- Se você tiver alguma tabela 100% pública (ex: landing stats), adicione um GRANT específico.

COMMIT;

-- ============================================================
-- FIM. Após rodar, valide com:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
-- Todas as tabelas devem aparecer com rowsecurity = true.
-- ============================================================
