-- ============================================================
-- LUMY FINANCE — RLS HELPERS HARDENING
-- ============================================================
-- Refatora is_workspace_member / can_write / is_workspace_admin
-- com SECURITY DEFINER + search_path travado + checagem de auth.uid().
--
-- Rode DEPOIS de setup-database.sql e SECURITY_PATCH.sql.
-- É idempotente — pode rodar quantas vezes quiser.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- 1) Remove versões antigas (qualquer assinatura) pra evitar conflito
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_workspace_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_write(UUID)           CASCADE;
DROP FUNCTION IF EXISTS public.is_workspace_admin(UUID)  CASCADE;
DROP FUNCTION IF EXISTS public.get_workspace_role(UUID)  CASCADE;

-- ----------------------------------------------------------------
-- 2) Helpers reforçados
-- ----------------------------------------------------------------
-- Todos os helpers seguem o MESMO padrão de hardening:
--   * SECURITY DEFINER       → executa com privilégios do owner (bypassa RLS
--                              da própria workspace_members, evitando recursão)
--   * SET search_path = ...  → impede ataque de search_path hijacking
--   * STABLE                 → cacheável dentro da mesma query (perf)
--   * auth.uid() IS NOT NULL → nega anônimo explicitamente
--   * RETURNS BOOLEAN        → fail-closed (NULL nunca passa em RLS USING)

-- 2.1) É membro ativo do workspace?
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND ws_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id      = auth.uid()
        AND wm.accepted_at IS NOT NULL
    );
$$;

-- 2.2) Pode escrever (owner/admin/editor)?
CREATE OR REPLACE FUNCTION public.can_write(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND ws_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id      = auth.uid()
        AND wm.accepted_at IS NOT NULL
        AND wm.role IN ('owner', 'admin', 'editor')
    );
$$;

-- 2.3) É admin (owner/admin)?
CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND ws_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id      = auth.uid()
        AND wm.accepted_at IS NOT NULL
        AND wm.role IN ('owner', 'admin')
    );
$$;

-- 2.4) Role do user no workspace (NULL se não for membro)
CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT wm.role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = ws_id
    AND wm.user_id      = auth.uid()
    AND wm.accepted_at IS NOT NULL
    AND auth.uid() IS NOT NULL
  LIMIT 1;
$$;

-- ----------------------------------------------------------------
-- 3) Lock down de privilégios das funções
-- ----------------------------------------------------------------
-- Por padrão, CREATE FUNCTION concede EXECUTE pra PUBLIC.
-- Vamos remover e dar EXECUTE só pra authenticated (anon NÃO pode chamar).
REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write(UUID)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_admin(UUID)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_workspace_role(UUID)  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(UUID)  TO authenticated;

-- ----------------------------------------------------------------
-- 4) Fixa OWNER das funções (importante pra SECURITY DEFINER)
-- ----------------------------------------------------------------
-- O dono define com quais privilégios a função roda. No Supabase, o owner
-- recomendado é o role `postgres`. Esse ALTER falha silenciosamente se o
-- usuário corrente não tiver permissão (em projetos novos rola normal).
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER FUNCTION public.is_workspace_member(UUID) OWNER TO postgres';
    EXECUTE 'ALTER FUNCTION public.can_write(UUID)           OWNER TO postgres';
    EXECUTE 'ALTER FUNCTION public.is_workspace_admin(UUID)  OWNER TO postgres';
    EXECUTE 'ALTER FUNCTION public.get_workspace_role(UUID)  OWNER TO postgres';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping OWNER change — current role cannot reassign.';
  END;
END
$$;

COMMIT;

-- ============================================================
-- Validação rápida (rode separado, fora do BEGIN):
-- ============================================================
-- SELECT proname, prosecdef AS security_definer,
--        proconfig AS settings, provolatile
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('is_workspace_member','can_write','is_workspace_admin','get_workspace_role');
--
-- Esperado:
--   prosecdef = true
--   proconfig contém "search_path=public, pg_temp"
--   provolatile = 's' (STABLE)
-- ============================================================
