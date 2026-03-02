

# Plano de Migração Completa: Lumyf (Next.js → React + Vite + Tailwind)

## Contexto

O projeto Lumyf e um SaaS financeiro completo em Next.js 14 com ~60+ componentes, 4 idiomas, 16+ tabelas Supabase, Stripe (atualmente em modo live), Server Actions, SSR, e PWA. O Lovable roda React + Vite (client-side only), entao toda logica server-side precisa ser convertida para chamadas diretas ao Supabase client e Edge Functions.

## Requisitos do Usuario
1. Migrar todo o projeto para funcionar no Lovable
2. Usar Supabase externo (nao Lovable Cloud)
3. Stripe em modo teste (trocar chaves live por test keys)

## Escopo e Fases

Este projeto sera implementado em **8 fases incrementais**, cada uma entregando valor visual e funcional.

---

### Fase 1 — Fundacao e Infraestrutura
- Criar projeto React + Vite + TypeScript + Tailwind
- Portar `globals.css` (variaveis CSS, temas, acessibilidade)
- Portar `tailwind.config.ts` (cores, gradientes, sombras)
- Instalar e configurar `react-router-dom`
- Criar `ThemeProvider` (portar direto, ja e client-side)
- Criar componente `Logo` (trocar `next/image` por `<img>`)
- Criar sistema de i18n client-side simples (React Context + JSON) portando os 4 arquivos de mensagens (pt-BR, pt-PT, en, es)
- Portar `product-config.ts` (sem dependencias de Next.js)
- Portar `src/types/database.ts` (tipos TypeScript puros)

### Fase 2 — Landing Page
- Portar `LandingPage.tsx` completa (hero, features, steps, FAQ, CTA, footer)
- Portar `LandingPricing` / `PlanCard`
- Portar `LocaleSwitcher`
- Portar `LandingHeader` com menu mobile
- Adaptar links de `next-intl Link` para `react-router-dom Link`

### Fase 3 — Supabase + Autenticacao
- Conectar Supabase externo (pedir URL e anon key ao usuario)
- Criar `supabaseClient.ts` usando `@supabase/supabase-js`
- Criar `AuthProvider` (context com `onAuthStateChange`)
- Portar Login, Register, Forgot Password, Reset Password
- Criar `ProtectedRoute` wrapper
- Portar `config.ts` (validacao de chaves)

### Fase 4 — Dashboard Shell
- Portar `Sidebar` (navegacao, grupos, collapse, mobile drawer)
- Portar `Header` com notification bell e command palette trigger
- Criar `DashboardShell` layout (sidebar + header + outlet)
- Portar `WorkspaceProvider` (context com localStorage para workspace selecionado)
- Portar `VisitorContext` e `VisitorBanner`

### Fase 5 — Paginas do Dashboard (Core)
- Dashboard principal (grid de meses com balanco — converter RPC server para query client)
- Transacoes (listagem, filtros, formulario, edicao)
- Orcamentos (listagem com modal, alertas)
- Metas (listagem, contribuicoes, formulario)
- Investimentos (listagem, historico, filtros)
- Cobrancas/Recebiveis (listagem, filtros)
- Recorrentes (listagem)
- Relatorios (graficos com Recharts — `CashFlowChart`, `CategoryPieChart`, `InvestmentEvolutionChart`)
- Cada pagina: converter Server Actions para queries diretas ao Supabase client

### Fase 6 — Funcionalidades Complementares
- Command Palette (cmdk)
- Notifications (bell + listagem)
- Import/Export CSV (PapaParse)
- Onboarding steps e welcome banner
- Support request form
- Projecoes financeiras

### Fase 7 — Stripe (Modo Teste)
- Configurar Stripe com test keys (pedir `pk_test_` e `sk_test_` ao usuario)
- Criar Edge Function para checkout session (substitui API route do Next.js)
- Criar Edge Function para webhook Stripe (substitui API route)
- Portar `billing.ts` logic para Edge Functions
- Portar `BillingCard`, `PlanCard` no settings
- Portar portal de billing

### Fase 8 — Workspace, Settings e Extras
- Workspace management (criar, trocar, membros, convites)
- Settings (perfil, preferencias, localizacao)
- Blog (portar conteudo estatico)
- Paginas legais (termos, privacidade, reembolso)
- Admin beta (se necessario)
- PWA manifest

---

## Detalhes Tecnicos

### Substituicoes Principais

| Next.js | Lovable (React + Vite) |
|---|---|
| `next-intl` | Context + JSON (i18n proprio) |
| Server Actions (`"use server"`) | Supabase client queries + Edge Functions |
| `cookies()` / `headers()` | `localStorage` / Supabase session |
| API Routes (`app/api/...`) | Supabase Edge Functions |
| `next/image` | `<img>` nativo |
| `next/font` | Google Fonts via `<link>` |
| File-based routing | `react-router-dom` |
| `createClient` (SSR) | `createClient` (browser) |

### Supabase Externo
- O usuario precisara fornecer `SUPABASE_URL` e `SUPABASE_ANON_KEY` do projeto existente
- O banco de dados ja existe com todas as tabelas, RLS, e funcoes
- Nao e necessario recriar schema — apenas conectar

### Stripe Modo Teste
- Trocar chaves live por test keys (`pk_test_...`, `sk_test_...`)
- Webhook secret de teste (`whsec_...` do Stripe CLI)
- Edge Functions para checkout e webhook (substituem API routes do Next.js)
- Secrets armazenados via Supabase secrets

### Estimativa de Esforco
- Fase 1-2: ~8-12 mensagens
- Fase 3: ~5-8 mensagens
- Fase 4: ~5-8 mensagens
- Fase 5: ~20-30 mensagens (maior fase)
- Fase 6: ~8-12 mensagens
- Fase 7: ~8-12 mensagens
- Fase 8: ~10-15 mensagens
- **Total estimado: ~65-100 mensagens**

