# Deploy para Produção — Lumyf

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

### Obrigatórias
- `NEXT_PUBLIC_APP_URL` — Em produção: `https://seudominio.com.br`
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Supabase Auth (confirmação de e-mail)
Para o app enviar e-mail de confirmação no cadastro:

1. No **Supabase Dashboard**: **Authentication** → **Providers** → **Email**
2. Ative **"Confirm email"** (o Supabase só envia o e-mail de confirmação quando esta opção está ligada)
3. Em **Authentication** → **URL Configuration** → **Redirect URLs**, adicione:
   - Desenvolvimento: `http://localhost:3000/api/auth/callback`
   - Produção: `https://seudominio.com.br/api/auth/callback`  
   Ou use wildcard: `http://localhost:3000/**` e `https://seudominio.com.br/**`

### Stripe
1. Crie uma conta em [stripe.com](https://stripe.com)
2. No Dashboard: **Produtos** → crie dois produtos (Pro e Business)
3. Crie preços mensais em **duas moedas** por produto:
   - BRL (R$) para Brasil → `STRIPE_PRICE_PRO` e `STRIPE_PRICE_BUSINESS`
   - USD (US$) para internacional → `STRIPE_PRICE_PRO_USD` e `STRIPE_PRICE_BUSINESS_USD`
4. **Chaves** → copie `sk_live_xxx` para `STRIPE_SECRET_KEY`
5. **Webhooks** → adicione endpoint: `https://seudominio.com.br/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copie o `whsec_xxx` para `STRIPE_WEBHOOK_SECRET`

## Domínio

1. Configure o domínio no provedor de hospedagem (Vercel, etc.)
2. Aponte o DNS para o deploy
3. Ative HTTPS (geralmente automático na Vercel)
4. Atualize `NEXT_PUBLIC_APP_URL` com o domínio final

## Idioma

O app detecta o idioma do navegador automaticamente na primeira visita e persiste no cookie `NEXT_LOCALE`. Todos os textos usam `next-intl` — evite strings hardcoded para não misturar idiomas.

## Checklist Legal e Compliance

- [ ] **Termos de Uso** — `/terms` publicado e linkado no rodapé
- [ ] **Política de Privacidade** — `/privacy` publicada (LGPD/GDPR)
- [ ] **Política de Reembolso** — `/refund` publicada e linkada
- [ ] **E-mail de suporte** — Substitua placeholders nas políticas pelo e-mail real
- [ ] **Stripe** — Confirme que o Stripe está disponível no seu país e que sua conta bancária aceita as moedas recebidas (BRL e USD)

## Build

```bash
npm run build
npm run start
```
