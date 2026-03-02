-- Corrige lint de segurança: RLS desabilitado em tabela pública (rls_disabled_in_public).
-- A tabela stripe_events_processed é usada pelo webhook Stripe (service_role).
-- Com RLS ativo e sem políticas para anon/authenticated, apenas service_role (que ignora RLS) acessa.

ALTER TABLE public.stripe_events_processed
  ENABLE ROW LEVEL SECURITY;
