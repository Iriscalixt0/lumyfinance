# Relatório de Implementação — Lumyf SaaS

**Data:** 21 de fevereiro de 2026  
**Escopo:** Requisitos legais, compliance (LGPD/GDPR), checkout global e experiência do usuário

---

## 1. Resumo Executivo

Implementações realizadas para preparar o Lumyf para vendas globais, com foco em:

- Documentos legais (Termos, Privacidade, Reembolso)
- Cumprimento de LGPD e GDPR
- Checkout Stripe com suporte a BRL e USD
- UI com preços na moeda correta por região

---

## 2. Requisitos Legais e Políticas

### 2.1 Termos de Uso (`/terms`)

**Rota:** `/[locale]/terms`

**Seções incluídas:**

1. Aceitação dos Termos  
2. Descrição do Serviço  
3. Responsabilidades do Usuário (veracidade dos dados, sigilo, controle de acesso)  
4. Planos e Pagamento (integração Stripe, link para Política de Reembolso)  
5. Modificações  
6. Rescisão  
7. Isenção de Garantias  
8. Contato  

---

### 2.2 Política de Privacidade (`/privacy`)

**Rota:** `/[locale]/privacy`

**Seções incluídas (LGPD/GDPR):**

1. Controlador de Dados  
2. Dados Coletados (autenticação, operação, localização opcional, pagamentos)  
3. Finalidade e Base Legal  
4. Compartilhamento (Supabase, Stripe)  
5. Segurança  
6. Direitos do Titular (LGPD/GDPR): acesso, correção, exclusão, revogação, oposição, portabilidade  
7. Retenção  
8. Transferência Internacional  
9. Cookies e Tecnologias  
10. Alterações  
11. Contato  

---

### 2.3 Política de Reembolso (`/refund`)

**Rota:** `/[locale]/refund`

**Seções incluídas:**

1. **Período de Teste** — 2 dias gratuitos, sem cobrança  
2. **Direito ao Reembolso** — 7 dias após primeira cobrança (CDC)  
3. **Como Solicitar** — e-mail de suporte  
4. **Cancelamento de Assinatura** — via Portal do Cliente Stripe  
5. **Exceções** — erros, cobranças duplicadas, falhas graves  
6. **Processamento** — via Stripe  
7. **Contato**  

---

### 2.4 Links e Navegação

- Links para Termos, Privacidade e Reembolso no rodapé da landing page  
- Links para Termos, Privacidade e Reembolso na página de Configurações  
- Navegação cruzada entre as três políticas em cada página  

---

## 3. Compliance LGPD e GDPR

- Política de Privacidade em conformidade com LGPD (Brasil) e GDPR (UE/EEE)  
- Direitos do titular descritos (acesso, correção, exclusão, portabilidade, oposição)  
- Referência à possibilidade de reclamação à autoridade de proteção de dados (UE/EEE)  
- Base legal descrita (execução de contrato, consentimento, legítimo interesse)  
- Transferência internacional com salvaguardas  

---

## 4. Checkout Stripe e Vendas Globais

### 4.1 API Route: `POST /api/checkout/session`

**Parâmetros:**

| Parâmetro   | Obrigatório | Descrição                               |
|------------|-------------|-----------------------------------------|
| `country`  | Sim         | País do usuário (ex: "BR", "US")       |
| `plan`     | Não         | "pro" ou "business" (padrão: "pro")    |
| `workspaceId` | Não      | UUID do workspace (para vincular)      |
| `successUrl`  | Não      | URL de sucesso                          |
| `cancelUrl`   | Não      | URL de cancelamento                     |
| `locale`      | Não      | Locale do app (padrão: "pt-BR")       |

**Regras por país:**

- **BR:** preços em BRL, PIX + cartão  
- **Outros:** preços em USD, cartão  

**Variáveis de ambiente usadas:**

- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` (BRL)  
- `STRIPE_PRICE_PRO_USD`, `STRIPE_PRICE_BUSINESS_USD` (USD)  

---

### 4.2 Billing Action (Server Action)

- `createCheckoutSession` atualizado para:  
  - Usar `locale` para determinar país (pt-BR → BR)  
  - Selecionar preço BRL ou USD  
  - Habilitar PIX para Brasil  
  - Montar URLs de sucesso/cancelamento com `locale`  

- `createBillingPortalSession` atualizado para incluir `locale` na URL de retorno  

---

### 4.3 Configuração de Preços no Stripe

- Dois preços por produto (Pro e Business):  
  - BRL (R$) para Brasil  
  - USD (US$) para internacional  

- Variáveis em `.env.local`:
  - `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`  
  - `STRIPE_PRICE_PRO_USD`, `STRIPE_PRICE_BUSINESS_USD`  

---

## 5. Experiência do Usuário (UI por Região)

### 5.1 Billing Card (Configurações)

- Preços exibidos conforme locale:  
  - pt-BR: R$ X,XX/mês  
  - en (e outros): US$ X.XX/mês  

- Formatação: vírgula para BRL, ponto para USD  

### 5.2 Product Config (`src/lib/product-config.ts`)

- `priceProMonthly`, `priceBusinessMonthly` (BRL)  
- `priceProMonthlyUSD`, `priceBusinessMonthlyUSD` (USD)  
- `isBRLocale(locale)`  
- `getPlanPrice(plan, locale)` — retorna valor, moeda e símbolo  

### 5.3 URLs de Checkout

- `success_url` e `cancel_url` incluem `locale`:  
  `{APP_URL}/{locale}/dashboard/settings?checkout=success`  

---

## 6. Arquivos Criados ou Modificados

| Arquivo | Ação |
|---------|------|
| `src/app/[locale]/terms/page.tsx` | Expandido |
| `src/app/[locale]/privacy/page.tsx` | Expandido |
| `src/app/[locale]/refund/page.tsx` | Criado |
| `src/app/api/checkout/session/route.ts` | Criado |
| `src/lib/stripe/config.ts` | Adicionado USD price IDs |
| `src/lib/product-config.ts` | Adicionado preços USD e helpers |
| `src/actions/billing.ts` | Suporte a BR/USD, locale, PIX |
| `src/components/settings/billing-card.tsx` | Preço por moeda |
| `src/app/dashboard/settings/settings-content.tsx` | Link Reembolso |
| `src/components/landing/LandingPage.tsx` | Link Reembolso |
| `.env.example` | STRIPE_PRICE_*_USD |
| `docs/DEPLOYMENT.md` | Checklist legal, preços dual-currency |

---

## 7. Checklist Pós-Implementação

- [ ] Definir e-mail de suporte nas políticas (Termos, Privacidade, Reembolso)  
- [ ] Preencher `STRIPE_PRICE_PRO_USD` e `STRIPE_PRICE_BUSINESS_USD` em `.env.local`  
- [ ] Conferir disponibilidade do Stripe no seu país  
- [ ] Conferir se a conta bancária aceita BRL e USD  

---

## 8. Referências

- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploy e variáveis de ambiente  
- [.env.example](../.env.example) — modelo de variáveis  
