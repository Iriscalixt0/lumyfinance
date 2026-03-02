-- ============================================================
-- BACKFILL: usuários que já existiam ANTES de rodar setup-database.sql
-- Rode este script UMA VEZ no SQL Editor (Supabase) para criar
-- profile + workspace + categorias para quem já estava cadastrado.
-- ============================================================

-- 1) Criar profile para usuários de auth.users que ainda não têm
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Usuário'),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 2) Criar workspace + member para quem tem profile mas não tem workspace
INSERT INTO public.workspaces (name, slug, owner_id)
SELECT
  'Minhas Finanças',
  'personal-' || replace(p.id::text, '-', ''),
  p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.user_id = p.id AND wm.accepted_at IS NOT NULL
);

-- 3) Adicionar como membro owner nos workspaces recém-criados (owner_id = user)
INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
SELECT w.id, w.owner_id, 'owner', NOW()
FROM public.workspaces w
WHERE w.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
  );

-- 4) Criar categorias padrão para workspaces que ainda não têm
DO $$
DECLARE
  ws_id UUID;
BEGIN
  FOR ws_id IN
    SELECT w.id FROM public.workspaces w
    WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.workspace_id = w.id LIMIT 1)
  LOOP
    PERFORM public.seed_default_categories(ws_id);
  END LOOP;
END $$;
