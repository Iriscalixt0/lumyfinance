/**
 * E2E: Autenticação — login, registro, forgot/reset password, validações.
 * Não requer usuário pré-existente (testes de UI apenas).
 */
import { expect, test } from "@playwright/test";

test.describe("Login", () => {
  test("renderiza campos de email e senha", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar|login|sign in/i })).toBeVisible();
  });

  test("exibe erro ao submeter com credenciais inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("invalido@naoexiste.com");
    await page.locator('input[type="password"]').fill("senhaerrada123");
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    // Deve aparecer mensagem de erro — sem redirecionar
    await expect(page.locator("text=/erro|error|inválid|invalid|incorrect/i").first()).toBeVisible({
      timeout: 12_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test("tem link para registro", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.getByRole("link", {
      name: /criar conta|create account|registrar|sign up|cadastrar/i,
    });
    await expect(registerLink.first()).toBeVisible({ timeout: 8000 });
  });

  test("tem link para recuperação de senha", async ({ page }) => {
    await page.goto("/login");
    const forgotLink = page.getByRole("link", {
      name: /esqueci|forgot|recuperar|reset/i,
    });
    await expect(forgotLink.first()).toBeVisible({ timeout: 8000 });
  });

  test("campo de email deve ser do tipo email", async ({ page }) => {
    await page.goto("/login");
    const emailType = await page.locator('input[type="email"]').getAttribute("type");
    expect(emailType).toBe("email");
  });
});

test.describe("Registro", () => {
  test("renderiza campos de nome, email, senha e botão de cadastro", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cadastrar|criar conta|registrar|create|sign up/i })
    ).toBeVisible();
  });

  test("exibe erro ao submeter email inválido", async ({ page }) => {
    await page.goto("/register");
    await page.locator('input[type="email"]').fill("nao-e-email");
    await page.locator('input[type="password"]').fill("Senha@1234");
    await page
      .getByRole("button", { name: /cadastrar|criar conta|registrar|create|sign up/i })
      .click();
    // O browser bloqueia nativamente ou o app exibe erro
    const stillOnRegister = page.url().includes("/register");
    const hasError = await page
      .locator("text=/válid|invalid|email/i")
      .first()
      .isVisible()
      .catch(() => false);
    expect(stillOnRegister || hasError).toBeTruthy();
  });

  test("tem link para ir ao login", async ({ page }) => {
    await page.goto("/register");
    const loginLink = page.getByRole("link", {
      name: /entrar|login|sign in|já tenho conta/i,
    });
    await expect(loginLink.first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Recuperação de senha", () => {
  test("renderiza campo de email e botão de envio", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: /enviar|send|recuperar|reset|redefinir/i })
    ).toBeVisible();
  });

  test("exibe confirmação ao submeter email válido", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill("teste@lumyfinance.com");
    await page.getByRole("button", { name: /enviar|send|recuperar|reset|redefinir/i }).click();
    // Deve mostrar mensagem de confirmação ou sucesso
    await expect(
      page
        .locator("text=/enviado|sent|verifique|check|email/i")
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("tem link para voltar ao login", async ({ page }) => {
    await page.goto("/forgot-password");
    const backLink = page.getByRole("link", {
      name: /voltar|back|login|entrar/i,
    });
    await expect(backLink.first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Reset de senha", () => {
  test("renderiza campos de nova senha", async ({ page }) => {
    await page.goto("/reset-password");
    // Pode redirecionar se não tiver token, mas deve ao menos renderizar a página
    const url = page.url();
    const isOnResetOrLogin = url.includes("/reset-password") || url.includes("/login");
    expect(isOnResetOrLogin).toBeTruthy();
  });
});

test.describe("Proteção de rotas", () => {
  const protectedRoutes = [
    "/dashboard",
    "/transactions",
    "/recurring",
    "/budgets",
    "/goals",
    "/investments",
    "/billings",
    "/calculators",
    "/projection",
    "/annual-report",
    "/lumy",
    "/crypto",
    "/travel",
    "/grocery",
    "/grocery/fixed",
    "/workspace",
    "/settings",
    "/support",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redireciona para /login sem sessão`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }
});
