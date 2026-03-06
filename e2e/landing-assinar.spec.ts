import { expect, test } from "@playwright/test";

test.describe("Landing page CTAs", () => {
  test("hero CTA links to /register", async ({ page }) => {
    await page.goto("/");
    const ctaHero = page.getByRole("link", {
      name: /começar|start|grátis|free|criar conta|create account/i,
    });
    await expect(ctaHero.first()).toBeVisible({ timeout: 8000 });
    await ctaHero.first().click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("header 'Criar conta' links to /register", async ({ page }) => {
    await page.goto("/");
    const criarConta = page.getByRole("link", {
      name: /criar conta|create account|registrarse|créer un compte|konto erstellen/i,
    });
    await expect(criarConta.first()).toBeVisible({ timeout: 8000 });
    await criarConta.first().click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("header login link goes to /login", async ({ page }) => {
    await page.goto("/");
    const entrar = page.getByRole("link", {
      name: /^(entrar|login|sign in|iniciar sesión|se connecter|anmelden)$/i,
    });
    await expect(entrar.first()).toBeVisible({ timeout: 8000 });
    await entrar.first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("pricing section CTA links to /register", async ({ page }) => {
    await page.goto("/#precos");
    await page.waitForTimeout(500);
    const ctaPreco = page.locator("#precos").getByRole("link", {
      name: /começar|start|grátis|free/i,
    });
    await expect(ctaPreco.first()).toBeVisible({ timeout: 8000 });
    await ctaPreco.first().click();
    await expect(page).toHaveURL(/\/register/);
  });
});
