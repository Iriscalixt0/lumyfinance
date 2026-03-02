-- Tabela para lista de espera do beta
-- Execute este SQL no Supabase SQL Editor antes de usar a feature de waitlist

create table if not exists public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

-- RLS: somente service role tem acesso (nenhum acesso pelo anon key)
alter table public.waitlist_emails enable row level security;

-- Sem políticas públicas — acesso apenas via service role key
-- (O server action usa o admin client com service role key)
