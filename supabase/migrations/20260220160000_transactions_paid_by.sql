-- Modo casal/família: quem pagou
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS split_type TEXT DEFAULT 'single' CHECK (split_type IN ('single', 'split_equal', 'split_custom'));
