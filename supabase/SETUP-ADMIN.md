# Setup Admin — Login e senha de testes

## Credenciais padrão

| Campo  | Valor           |
|--------|-----------------|
| E-mail | `admin@teste.com` |
| Senha  | `admin123`        |

## Como criar o usuário de teste

1. Certifique-se de que o banco já foi configurado (`supabase/setup-database.sql` executado no SQL Editor).
   - **Se você já tinha uma conta antes de rodar o setup:** execute também `supabase/backfill-existing-users.sql` no SQL Editor (uma vez). Isso cria o workspace e as categorias para usuários que existiam antes do trigger.
2. Em `.env.local`, defina:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. (Opcional) Para usar outro e-mail/senha:
   - `ADMIN_TEST_EMAIL=seu@email.com`
   - `ADMIN_TEST_PASSWORD=suasenha`
4. Rode o script:

```bash
npm run setup-admin
```

Se o usuário já existir, o script apenas mostra as credenciais. Caso contrário, cria o usuário no Supabase Auth. O trigger do banco cria automaticamente o perfil, o workspace "Minhas Finanças" e as categorias padrão.

5. Acesse `/login` e entre com o e-mail e a senha configurados.
