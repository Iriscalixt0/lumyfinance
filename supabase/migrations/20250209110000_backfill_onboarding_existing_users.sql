-- Marcar onboarding como concluído para usuários que já existiam antes do onboarding
-- Assim, só novos usuários (primeiro login após criar conta) verão o fluxo de onboarding
UPDATE public.profiles
SET onboarding_completed_at = NOW(), updated_at = NOW()
WHERE onboarding_completed_at IS NULL;
