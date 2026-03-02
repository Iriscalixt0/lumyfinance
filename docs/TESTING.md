# Guia de Testes Automatizados

Este documento descreve a estrutura, configuração e execução dos testes automatizados do projeto, incluindo testes de integração e E2E.

## Estrutura de Pastas

```
NossoFuturo-Saas/
├── tests/
│   └── integration/           # Testes de integração (Vitest)
│       ├── setup.ts           # Carrega .env.local
│       ├── billing.integration.test.ts
│       ├── webhook.integration.test.ts
│       └── api.integration.test.ts
├── e2e/                       # Testes E2E (Playwright)
│   ├── routing.spec.ts        # Rotas e localização
│   └── checkout.spec.ts       # Fluxo completo de checkout
├── src/
│   └── **/*.test.ts           # Testes unitários (Vitest)
└── playwright.config.ts
```

## Pré-requisitos

1. **Variáveis de ambiente** — Use o mesmo `.env.local` do desenvolvimento:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY` (obrigatoriamente `sk_test_...`)
   - `STRIPE_WEBHOOK_SECRET` (para testes de webhook)
   - `STRIPE_PRICE_PRO` ou `STRIPE_PRICE_PRO_USD`
   - `NEXT_PUBLIC_APP_URL` (ex: `http://localhost:3200` para E2E)

2. **Stripe Test Mode** — Todos os testes usam Stripe em modo teste. Não use chaves de produção.

3. **Supabase** — Banco de desenvolvimento configurado. Os testes criam e removem dados de teste.

## Executando os Testes

### Testes unitários

```bash
npm run test:unit
# ou
npm run test
```

### Testes de integração

```bash
npm run test:integration
```

**Importante para o teste de webhook:** o teste que valida o webhook Stripe faz `POST` para `/api/webhooks/stripe`. Para que funcione, o servidor Next.js precisa estar rodando:

```bash
# Terminal 1
npm run dev -- --port 3200

# Terminal 2
npm run test:integration
```

### Testes E2E (Playwright)

O Playwright inicia o servidor automaticamente (`webServer` no `playwright.config.ts`).

```bash
npm run test:e2e
```

Apenas os testes de checkout:

```bash
npm run test:e2e:checkout
```

Modo headed (com navegador visível):

```bash
npm run test:e2e:headed
```

## Cartão de teste Stripe

Para E2E de pagamento:

- **Número:** `4242 4242 4242 4242`
- **Validade:** qualquer data futura (ex: 12/34)
- **CVC:** qualquer 3 dígitos (ex: 123)

## O que cada teste cobre

### Integração (billing.integration.test.ts)

- Confirmação de trial de 7 dias no `product-config`
- Criação de sessão de checkout com trial
- Criação de assinatura com trial e verificação de status
- Cancelamento antes do fim do trial e verificação de que não houve cobrança

### Integração (api.integration.test.ts)

- Checkout API retorna 401 quando não autenticado
- Webhook retorna 400 quando assinatura ausente

### Integração (webhook.integration.test.ts)

- Rejeição de requisição sem assinatura
- Processamento de `checkout.session.completed` e atualização do workspace no banco

### E2E (checkout.spec.ts)

- Registro de usuário
- Login
- Navegação até Configurações
- Seleção do plano Pro e redirecionamento ao Stripe Checkout
- Preenchimento do cartão de teste
- Retorno à página de sucesso
- Verificação de que o acesso está liberado

## Limpeza e isolamento

- **Integração:** os testes criam clientes e assinaturas no Stripe e workspaces no Supabase e fazem a limpeza em `afterAll`.
- **E2E:** cada execução usa um e-mail único (`e2e-{timestamp}@...`), evitando conflitos.

## Supabase e confirmação de e-mail

### Fluxo atual

O cadastro usa `supabase.auth.signUp()` em `src/app/[locale]/(auth)/register/page.tsx`. O comportamento depende da configuração do Supabase:

- **Se "Confirm email" estiver desativado:** o Supabase retorna `data.session` imediatamente e não envia e-mail. O código redireciona o usuário para `/dashboard` (linhas 95–99).
- **Se "Confirm email" estiver ativado:** o Supabase não retorna sessão; envia um e-mail de confirmação. O app exibe "Verifique seu e-mail" e o usuário precisa clicar no link antes de acessar o dashboard.

Se o usuário vai direto ao dashboard sem receber e-mail, é provável que "Confirm email" esteja desativado no painel do Supabase.

### Configuração no Supabase

1. **Supabase Dashboard** → **Authentication** → **Providers** → **Email**
2. Ative **"Confirm email"** para exigir confirmação antes do login
3. Em produção: **Project Settings** → **Auth** → configure o SMTP para envio de e-mails

### Ambientes

- **Desenvolvimento:** pode desativar a confirmação ou usar Inbucket (Supabase local) para inspecionar os e-mails.
- **Produção:** recomenda-se ativar a confirmação e configurar SMTP para envio real.

### Para testes E2E contínuos

Se o Supabase exigir confirmação de e-mail, o fluxo E2E de registro pode parar na tela "Verifique seu e-mail". Para testes contínuos, você pode:

1. Desabilitar confirmação de e-mail em **Authentication > Providers > Email** (apenas para ambiente de desenvolvimento), ou
2. Usar um usuário de teste pré-cadastrado e confirmado.

## CI/CD

Para rodar em CI:

1. Defina as variáveis de ambiente (incluindo `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` em modo teste).
2. Os testes de integração que chamam o webhook precisam do servidor rodando; considere iniciar `next dev` em background antes dos testes.
3. Para Playwright em CI, use os browsers do Playwright (`npx playwright install`) ou um projeto com browsers configurados.
