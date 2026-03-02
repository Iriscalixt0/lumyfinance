# Guia de Testes e Cobertura

Este documento descreve como executar os testes automatizados e visualizar a cobertura de código.

## Estrutura de Pastas

```
tests/
├── integration/           # Testes de integração (Vitest)
│   ├── setup.ts           # Carrega .env.local
│   ├── api.integration.test.ts
│   ├── billing.integration.test.ts
│   └── webhook.integration.test.ts
├── utils/
│   └── cleanup.ts         # Utilitários de cleanup para dados de teste
└── README.md              # Este arquivo

e2e/                       # Testes E2E (Playwright)
└── checkout.spec.ts

src/**/*.test.ts           # Testes unitários co-localizados
```

## Pré-requisitos

1. **Variáveis de ambiente**: copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `STRIPE_SECRET_KEY` (sk_test_...)
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_PRO` ou `STRIPE_PRICE_PRO_USD`
   - `NEXT_PUBLIC_APP_URL` (ex: http://localhost:3000)

2. **Stripe Test Mode**: todos os testes usam Stripe em modo de teste. Não use chaves de produção.

3. **Supabase**: ambiente de desenvolvimento com tabelas migradas. Para os E2E de checkout completo (`E2E_RUN_FULL_CHECKOUT=1`), é necessário que o login funcione sem confirmação de e-mail: em **Authentication → Providers → Email**, desative **Confirm email** (em dev) ou use um projeto com exceção para o domínio dos e-mails de teste (`@e2e-checkout-test.placeholder.local`).

## Comandos para Executar Testes

### Unitários e Integração (Vitest)

```bash
# Todos os testes
npm test

# Apenas testes de integração
npm run test:integration

# Apenas testes unitários (src/**/*.test.ts)
npm run test:unit

# Com cobertura (line, branch, function)
npm run test:coverage

# Cobertura apenas para integração
npm run test:integration:coverage

# Cobertura apenas para unitários
npm run test:unit:coverage
```

### E2E (Playwright)

```bash
# Executa E2E (inicia o servidor automaticamente)
npm run test:e2e

# Apenas o fluxo de checkout
npm run test:e2e:checkout

# Modo headed (vê o navegador)
npm run test:e2e:headed
```

## Testes de Integração – Servidor Rodando

Os testes de API (`api.integration.test.ts`) e webhook (`webhook.integration.test.ts`) chamam as rotas via HTTP. **O servidor Next.js deve estar rodando**:

```bash
# Terminal 1: inicia o servidor
npm run dev

# Terminal 2: executa os testes de integração
npm run test:integration
```

Ou defina `NEXT_PUBLIC_APP_URL` para a URL do servidor (ex: `http://localhost:3000`).

## Relatório de Cobertura

Após rodar `npm run test:coverage`:

- **Terminal**: resumo no stdout (line, branch, function).
- **HTML**: abra `coverage/index.html` no navegador para detalhes.
- **LCOV**: `coverage/lcov.info` para integração com CI (ex: Codecov, Coveralls).

### Métricas

- **Line coverage**: linhas executadas
- **Branch coverage**: ramos if/else, switch
- **Function coverage**: funções chamadas

### Áreas Frequentemente Não Cobertas

- Rotas chamadas apenas via HTTP (servidor separado): cobertura é coletada apenas se o handler for invocado no processo Vitest.
- Middleware e código específico de edge.
- Páginas e componentes renderizados apenas no E2E (não instrumentados pelo Vitest).

## Webhook para E2E

Para que o E2E valide a assinatura no banco após checkout, o Stripe precisa enviar o webhook para sua aplicação local:

```bash
stripe listen --forward-to localhost:3200/api/webhooks/stripe
```

Use o `webhook signing secret` exibido (ex: `whsec_...`) como `STRIPE_WEBHOOK_SECRET` no `.env.local`.

### Checkout E2E: reconhecimento da assinatura na UI

Com `E2E_RUN_FULL_CHECKOUT=1`, o teste `e2e/checkout.spec.ts` cobre:

- **Banco:** `workspaces.stripe_subscription_id` e `plan = 'pro'` após o webhook.
- **Stripe API:** assinatura em status `trialing` ou `active` com trial de 7 dias.
- **UI desktop:** após reload, o botão/link "Assinar Pro" na sidebar some; na página de plano aparece "Gerenciar"; o banner "Para acessar o app, assine o plano Pro" não aparece; em Configurações aparece a seção "Plano e cobrança" e o botão "Gerenciar plano".
- **UI mobile:** o mesmo fluxo em viewport 390x844; menu aberto, verifica que "Assinar Pro" não aparece na sidebar e que o banner some.

## Limpeza de Dados de Teste

### Integração

Os testes de webhook e billing fazem cleanup em `afterAll`:
- Workspaces, profiles e workspace_members criados são removidos.
- Assinaturas e customers Stripe são cancelados/removidos.

### E2E

Usuários E2E usam o domínio `e2e-checkout-test.placeholder.local`. Para limpar manualmente:

1. No Supabase Dashboard: Auth → Users → filtrar por esse domínio.
2. Remover usuários de teste se necessário.
3. O Stripe Test Mode não cobra; assinaturas de teste podem ser ignoradas ou canceladas no Dashboard.

## Estratégia de Testes

| Tipo              | Ferramenta | Escopo                                      |
|-------------------|------------|---------------------------------------------|
| Unitário          | Vitest     | Actions, lib, utils, componentes isolados   |
| Integração        | Vitest     | API routes, webhooks, Stripe, Supabase      |
| E2E               | Playwright | Fluxo completo: registro → checkout → DB    |

### Regras

- **Sem mocks** de Stripe ou Supabase: ambiente real em Test Mode.
- **Nenhuma alteração** na lógica de negócio ou implementação existente.
- **Testes isolados e repetíveis**: cada teste limpa seus próprios dados.
