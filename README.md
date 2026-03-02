# NossoFuturo SaaSs

## Desenvolvimento

### Webhook Stripe (assinatura Proo)

Para que a assinatura seja reconhecida após o checkout em **ambiente local** (modo teste), o Stripe precisa conseguir enviar eventos para o seu servidor. Use o [Stripe CLI](https://stripe.com/docs/stripe-cli) para encaminhar os webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

O CLI exibirá um **webhook signing secret** (ex.: `whsec_...`). Defina-o em `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Sem isso, o evento `checkout.session.completed` não chega à aplicação, o workspace não recebe `stripe_subscription_id` e o app continua exibindo "Assinar Pro" e bloqueando ações.

**Eventos tratados:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.

**Metadata obrigatória:** a sessão de checkout deve enviar `metadata.workspace_id` (e `subscription_data.metadata.workspace_id`) para o webhook identificar o workspace. Isso já está configurado em `src/actions/billing.ts` e em `src/app/api/checkout/session/route.ts`.
