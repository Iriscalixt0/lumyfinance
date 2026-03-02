-- Auth bootstrap/backfill for projects that did not run setup-database.sql manually.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Base tables for partially configured databases.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Usuario',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan = 'pro'),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'box',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#6366f1',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_key ON public.workspaces(slug);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_key
  ON public.workspace_members(workspace_id, user_id);

CREATE OR REPLACE FUNCTION public.seed_default_categories(ws_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.categories WHERE workspace_id = ws_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.categories (workspace_id, name, icon, type, color, is_system) VALUES
    (ws_id, 'Salario', 'money', 'income', '#10b981', TRUE),
    (ws_id, 'Freelance', 'briefcase', 'income', '#06b6d4', TRUE),
    (ws_id, 'Presente', 'gift', 'income', '#f59e0b', TRUE),
    (ws_id, 'Outros Recebimentos', 'inbox', 'income', '#8b5cf6', TRUE),
    (ws_id, 'Supermercado', 'shopping-cart', 'expense', '#ef4444', TRUE),
    (ws_id, 'Moradia', 'home', 'expense', '#f97316', TRUE),
    (ws_id, 'Transporte', 'car', 'expense', '#eab308', TRUE),
    (ws_id, 'Saude', 'heart-pulse', 'expense', '#22c55e', TRUE),
    (ws_id, 'Lazer', 'gamepad-2', 'expense', '#3b82f6', TRUE),
    (ws_id, 'Compras', 'shopping-bag', 'expense', '#a855f7', TRUE),
    (ws_id, 'Outros Gastos', 'box', 'expense', '#64748b', TRUE);
END;
$$;

-- Ensure onboarding columns exist for old databases.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Usuario',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_intent TEXT
    CHECK (onboarding_intent IN ('personal', 'family', 'business', 'other'));

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'editor',
  ADD COLUMN IF NOT EXISTS invited_by UUID,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'box',
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Fallback function for authenticated users without workspace/profile.
CREATE OR REPLACE FUNCTION public.ensure_user_workspace()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  new_ws_id UUID;
  has_ws BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = uid AND accepted_at IS NOT NULL
    LIMIT 1
  ) INTO has_ws;

  IF has_ws THEN
    SELECT workspace_id INTO new_ws_id
    FROM public.workspace_members
    WHERE user_id = uid AND accepted_at IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;
    RETURN new_ws_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, updated_at)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Usuario'),
    u.raw_user_meta_data->>'avatar_url',
    NOW()
  FROM auth.users u
  WHERE u.id = uid
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES ('Minhas Financas', 'personal-' || replace(uid::text, '-', ''), uid)
  RETURNING id INTO new_ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
  VALUES (new_ws_id, uid, 'owner', NOW())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  PERFORM public.seed_default_categories(new_ws_id);

  RETURN new_ws_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_workspace() TO authenticated;

-- Ensure auth trigger exists for new users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ws_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT wm.workspace_id
  INTO new_ws_id
  FROM public.workspace_members wm
  WHERE wm.user_id = NEW.id
    AND wm.accepted_at IS NOT NULL
  LIMIT 1;

  IF new_ws_id IS NULL THEN
    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES ('Minhas Financas', 'personal-' || replace(NEW.id::text, '-', ''), NEW.id)
    ON CONFLICT (slug) DO UPDATE
      SET owner_id = EXCLUDED.owner_id
    RETURNING id INTO new_ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
    VALUES (new_ws_id, NEW.id, 'owner', NOW())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.workspace_id = new_ws_id
    LIMIT 1
  ) THEN
    PERFORM public.seed_default_categories(new_ws_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: users that existed before trigger/migrations.
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Usuario'),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

INSERT INTO public.workspaces (name, slug, owner_id)
SELECT
  'Minhas Financas',
  'personal-' || replace(p.id::text, '-', ''),
  p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.user_id = p.id
    AND wm.accepted_at IS NOT NULL
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
SELECT w.id, w.owner_id, 'owner', NOW()
FROM public.workspaces w
WHERE w.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id
      AND wm.user_id = w.owner_id
  )
ON CONFLICT (workspace_id, user_id) DO NOTHING;

DO $$
DECLARE
  ws_id UUID;
BEGIN
  FOR ws_id IN
    SELECT w.id
    FROM public.workspaces w
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.workspace_id = w.id
      LIMIT 1
    )
  LOOP
    PERFORM public.seed_default_categories(ws_id);
  END LOOP;
END
$$;
