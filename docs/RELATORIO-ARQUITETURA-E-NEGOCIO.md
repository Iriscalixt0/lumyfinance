# Relatório de Arquitetura e Negócio — Lumyf SaaS

> **Atualizado em**: 2026-03-02  
> **Stack real**: React 18 + Vite + TypeScript + Tailwind CSS + Supabase (externo) + Stripe

---

## 1. Visão do Produto

SaaS de controle financeiro pessoal, casal/família e pequenos contextos de negócio.

- **Núcleo funcional**: transações, investimentos, cobranças, metas, orçamentos, recorrências e relatórios.
- **Colaboração**: por workspace com membros e convites (e-mail ou link/token).
- **Monetização**: assinatura Stripe (plano Pro), trial de 7 dias.
- **Beta**: acesso temporário com ciclo active → ended → blocked, campanhas de conversão.

---

## 2. Stack e Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 7 + TypeScript |
| Estilo/UI | Tailwind CSS 3 + componentes custom |
| Backend | Supabase (Auth, Postgres, RLS, RPC) |
| Pagamentos | Stripe Checkout + Billing Portal + Webhooks |
| i18n | Custom provider com pt-BR, pt-PT, en, es |
| Testes | Vitest (unit/integration) + Playwright (E2E) |
| Validação | Zod |
| Gráficos | Recharts |

**Nota**: O projeto foi migrado de Next.js 14 para React + Vite para compatibilidade com o ambiente Lovable.

---

## 3. Funcionalidades Implementadas

### 3.1 Autenticação
- Login, cadastro, recuperação e reset de senha via Supabase Auth
- ProtectedRoute com redirect para /login

### 3.2 Dashboard
- Visão anual com 12 cards mensais (receitas - despesas)
- Quick links para todas as seções
- Banner de boas-vindas para novos usuários

### 3.3 Transações
- CRUD completo com categorias, tags e notas
- Valores em centavos (BIGINT)

### 3.4 Investimentos
- CRUD com tipos (CDB, LCI, Tesouro, Ações, FIIs, Crypto, Outro)
- Export CSV

### 3.5 Cobranças (Receivables)
- Status: pending | paid | overdue
- Filtros e export CSV

### 3.6 Metas
- CRUD com contribuições e progresso visual
- Alertas em 75%, 90% e 100%

### 3.7 Orçamentos
- Por categoria/mês com cálculo de uso
- Alertas em 80% e 100%

### 3.8 Recorrências
- CRUD completo com frequência semanal/quinzenal/mensal/anual
- Validação Zod

### 3.9 Relatório Anual
- Gráficos de fluxo de caixa e categorias

### 3.10 Onboarding
- Wizard de 3 passos: intenção, nome workspace, conclusão

### 3.11 Gestão de Workspace
- Criar, renomear, excluir workspace
- Convidar e gerenciar membros

### 3.12 Configurações
- Tema (claro/escuro), cores, tamanho de fonte
- Perfil do usuário
- Idioma

### 3.13 Landing Page
- Marketing com planos e CTA

---

## 4. Regras de Negócio

1. Onboarding obrigatório — rastreado em `profiles.onboarding_completed_at`
2. Plano único: **Pro** (R$29/mês) com trial de 7 dias
3. Sem assinatura: limite de 1 workspace e 3 transações
4. Com Pro/Beta/Admin: até 2 workspaces, 3 membros cada
5. Convite só por owner/admin
6. Convidado sem plano vira viewer (mantém granted_role)
7. Owner não pode sair do próprio workspace
8. Único workspace não pode ser excluído
9. Orçamento apenas para categorias de despesa
10. Unicidade: workspace + categoria + ano + mês

---

## 5. Banco de Dados

### Tabelas Principais
- `profiles`, `workspaces`, `workspace_members`, `workspace_invites`
- `categories`, `transactions`, `investments`
- `goals`, `goal_contributions`
- `budgets`, `receivables`, `recurring_transactions`

### Tabelas de Billing
- Colunas Stripe em `workspaces`
- `billing_portal_feedbacks`

### Tabelas Beta
- `beta_programs`, `beta_participants`
- `beta_contact_preferences`, `beta_conversion_campaign_events`

### RPCs
- `check_dashboard_access`
- `get_dashboard_year_summary`
- `get_workspace_invite_by_token`
- `get_workspace_members_with_profiles`

---

## 6. Segurança

- RLS em todas as tabelas com funções de membership
- Validação Zod em todos os formulários
- Anon key pública (OK), service role em secrets do servidor
- Toast de feedback em todas as operações CRUD

---

## 7. Checklist de Auditoria

### Alta Prioridade
- [x] Remover arquivos legados (workspaces.test.js, crm-flow.spec.js)
- [x] Corrigir nome do package.json
- [x] Implementar página de Configurações
- [x] Implementar Onboarding wizard
- [x] Implementar Gestão de workspace

### Média Prioridade
- [ ] Conectar formulário de suporte ao backend (createSupportRequest)
- [ ] Integrar WaitlistForm na landing
- [ ] Adicionar Sentry para error tracking
- [ ] Implementar PWA install prompt

### Baixa Prioridade
- [ ] Blog multilíngue
- [ ] Área admin beta
- [ ] Command palette
- [ ] Lançamento por voz
