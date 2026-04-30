-- Add multi-currency support columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS original_amount BIGINT,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Add active flag to recurring_transactions (for pause/resume)
ALTER TABLE public.recurring_transactions
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
