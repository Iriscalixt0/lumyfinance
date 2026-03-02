-- Função de fallback: garante que o usuário tenha ao menos um workspace
-- Útil quando o trigger handle_new_user não rodou (ex: migrations parciais)
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

  -- Criar profile se não existir
  INSERT INTO public.profiles (id, full_name, avatar_url, updated_at)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Usuário'),
    u.raw_user_meta_data->>'avatar_url',
    NOW()
  FROM auth.users u
  WHERE u.id = uid
  ON CONFLICT (id) DO NOTHING;

  -- Criar workspace (slug único por usuário)
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES ('Minhas Finanças', 'personal-' || replace(uid::text, '-', ''), uid)
  RETURNING id INTO new_ws_id;

  -- Adicionar como membro owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
  VALUES (new_ws_id, uid, 'owner', NOW());

  -- Categorias padrão
  PERFORM public.seed_default_categories(new_ws_id);

  RETURN new_ws_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_workspace() TO authenticated;
