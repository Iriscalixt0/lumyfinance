# Agentes IA — Lumyf SaaS

Prompts de sistema para usar no Cursor. Referencie o agente com `@` antes da sua pergunta.

## Agentes principais

| Arquivo | Uso |
|---------|-----|
| `master.md` | Orquestrador — decompor tarefas e delegar |
| `backend.md` | Server Actions, API routes, Supabase, Stripe |
| `frontend.md` | UI, componentes, design system, responsividade |
| `database.md` | Migrations, RLS, schema, PostgreSQL |
| `qa.md` | Testes (Vitest, Playwright), code review |
| `docs.md` | Copy, UX writing, documentação |
| `devops.md` | CI/CD, deploy, monitoramento, performance |

## Sub-agentes

| Arquivo | Uso |
|---------|-----|
| `sub-agents/stripe.md` | Billing, Checkout, webhooks Stripe |
| `sub-agents/auth.md` | Auth, RBAC, segurança |
| `sub-agents/charts.md` | Gráficos (Recharts), visualização de dados |
| `sub-agents/mobile.md` | Mobile-first, breakpoints, touch |

## Exemplos no Cursor

- Tarefa de backend: `@.prompts/backend.md` + sua pergunta
- Orquestrar uma feature: `@.prompts/master.md` + descrição da feature
- Billing/Stripe: `@.prompts/sub-agents/stripe.md` + sua pergunta
- Gráficos: `@.prompts/sub-agents/charts.md` + sua pergunta
