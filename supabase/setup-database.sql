-- ============================================================
-- LUMIFY — Setup do banco (Supabase SQL Editor)
-- Cole este script inteiro e execute (Run).
-- ============================================================

-- 1) Profiles (estende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Usuário',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Workspaces (tenants)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan = 'pro'),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Workspace Members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES public.profiles(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 4) Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#6366f1',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Accounts (opcional para MVP; transactions.account_id pode ser NULL)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'wallet')),
  balance BIGINT DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) Transactions (amount em centavos)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount BIGINT NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) Investments
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cdb', 'lci', 'lca', 'tesouro', 'acao', 'fii', 'crypto', 'outro')),
  amount BIGINT NOT NULL,
  current_value BIGINT,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) Goals
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount BIGINT NOT NULL,
  deadline DATE,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#ec4899',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9) Goal contributions
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON public.transactions(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_investments_workspace ON public.investments(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_workspace ON public.goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);


-- Função: seed categorias padrão (igual ao app atual)
CREATE OR REPLACE FUNCTION public.seed_default_categories(ws_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.categories (workspace_id, name, icon, type, color, is_system) VALUES
    (ws_id, 'Salário', '💰', 'income', '#10b981', TRUE),
    (ws_id, 'Freelance', '💸', 'income', '#06b6d4', TRUE),
    (ws_id, 'Presente', '🎁', 'income', '#f59e0b', TRUE),
    (ws_id, 'Outros Recebimentos', '📥', 'income', '#8b5cf6', TRUE),
    (ws_id, 'Supermercado', '🛒', 'expense', '#ef4444', TRUE),
    (ws_id, 'Moradia', '🏠', 'expense', '#f97316', TRUE),
    (ws_id, 'Transporte', '🚗', 'expense', '#eab308', TRUE),
    (ws_id, 'Saúde', '🏥', 'expense', '#22c55e', TRUE),
    (ws_id, 'Lazer', '🍔', 'expense', '#3b82f6', TRUE),
    (ws_id, 'Compras', '🛍️', 'expense', '#a855f7', TRUE),
    (ws_id, 'Outros Gastos', '📦', 'expense', '#64748b', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: novo usuário → profile + workspace + categorias
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_ws_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES ('Minhas Finanças', 'personal-' || substr(NEW.id::text, 1, 8), NEW.id)
  RETURNING id INTO new_ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
  VALUES (new_ws_id, NEW.id, 'owner', NOW());

  PERFORM public.seed_default_categories(new_ws_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: funções auxiliares
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid() AND accepted_at IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_write(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND accepted_at IS NOT NULL
    AND role IN ('owner', 'admin', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- RLS: ativar em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

-- Policies (profiles)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "Members can view same-workspace members profiles" ON public.profiles;
CREATE POLICY "Members can view same-workspace members profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm_me
      JOIN public.workspace_members wm_other
        ON wm_me.workspace_id = wm_other.workspace_id AND wm_other.user_id = profiles.id
      WHERE wm_me.user_id = auth.uid()
        AND wm_me.accepted_at IS NOT NULL
        AND wm_other.accepted_at IS NOT NULL
    )
  );
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Policies (workspaces)
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
CREATE POLICY "Members can view workspace" ON public.workspaces FOR SELECT USING (public.is_workspace_member(id));
DROP POLICY IF EXISTS "Owner can update workspace" ON public.workspaces;
CREATE POLICY "Owner can update workspace" ON public.workspaces FOR UPDATE USING (owner_id = auth.uid());

-- Policies (workspace_members)
DROP POLICY IF EXISTS "Members can view other members" ON public.workspace_members;
CREATE POLICY "Members can view other members" ON public.workspace_members FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
CREATE POLICY "Admins can manage members" ON public.workspace_members FOR ALL USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));
DROP POLICY IF EXISTS "Members can leave own workspace" ON public.workspace_members;
CREATE POLICY "Members can leave own workspace"
  ON public.workspace_members
  FOR DELETE
  USING (user_id = auth.uid() AND role <> 'owner' AND accepted_at IS NOT NULL);

-- Policies (categories, accounts, transactions, investments, goals, goal_contributions)
-- Categories
DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
CREATE POLICY "Members can view categories" ON public.categories FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Writers can manage categories" ON public.categories;
CREATE POLICY "Writers can manage categories" ON public.categories FOR ALL USING (public.can_write(workspace_id));

-- Accounts
DROP POLICY IF EXISTS "Members can view accounts" ON public.accounts;
CREATE POLICY "Members can view accounts" ON public.accounts FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Writers can manage accounts" ON public.accounts;
CREATE POLICY "Writers can manage accounts" ON public.accounts FOR ALL USING (public.can_write(workspace_id));

-- Transactions
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Writers can insert transactions" ON public.transactions;
CREATE POLICY "Writers can insert transactions" ON public.transactions FOR INSERT WITH CHECK (public.can_write(workspace_id));
DROP POLICY IF EXISTS "Writers can update transactions" ON public.transactions;
CREATE POLICY "Writers can update transactions" ON public.transactions FOR UPDATE USING (public.can_write(workspace_id));
DROP POLICY IF EXISTS "Writers can delete transactions" ON public.transactions;
CREATE POLICY "Writers can delete transactions" ON public.transactions FOR DELETE USING (public.can_write(workspace_id));

-- Investments
DROP POLICY IF EXISTS "Members can view investments" ON public.investments;
CREATE POLICY "Members can view investments" ON public.investments FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Writers can manage investments" ON public.investments;
CREATE POLICY "Writers can manage investments" ON public.investments FOR ALL USING (public.can_write(workspace_id));

-- Goals
DROP POLICY IF EXISTS "Members can view goals" ON public.goals;
CREATE POLICY "Members can view goals" ON public.goals FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Writers can manage goals" ON public.goals;
CREATE POLICY "Writers can manage goals" ON public.goals FOR ALL USING (public.can_write(workspace_id));

-- Goal contributions
DROP POLICY IF EXISTS "Members can view goal_contributions" ON public.goal_contributions;
CREATE POLICY "Members can view goal_contributions" ON public.goal_contributions FOR SELECT USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Writers can manage goal_contributions" ON public.goal_contributions;
CREATE POLICY "Writers can manage goal_contributions" ON public.goal_contributions FOR ALL USING (public.can_write(workspace_id));
