/**
 * E2E: botões de assinatura na página principal (landing).
 * Valida que os CTAs "Começar X dias grátis" e "Criar conta" funcionam.
 */
import { expect, test } from "@playwright/test";

const BASE_LOCALE = "pt-BR";

test.describe("Botão Assinar Plano - Página Principal", () => {
  test("landing pt-BR: botão 'Começar X dias grátis' deve levar para /register", async ({
    page,
  }) => {
    await page.goto(`/${BASE_LOCALE}`);
    const ctaHero = page.getByRole("link", {
      name: /começar \d+ dias grátis|começar.*grátis/i,
    });
    await expect(ctaHero.first()).toBeVisible({ timeout: 8000 });
    await ctaHero.first().click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("landing pt-BR: botão 'Criar conta' no header deve levar para /register", async ({
    page,
  }) => {
    await page.goto(`/${BASE_LOCALE}`);
    const criarConta = page.getByRole("link", { name: /criar conta/i });
    await expect(criarConta.first()).toBeVisible({ timeout: 8000 });
    await criarConta.first().click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("landing pt-BR: seção preços - CTA deve levar para /register", async ({
    page,
  }) => {
    await page.goto(`/${BASE_LOCALE}#precos`);
    await page.waitForTimeout(500);
    const ctaPreco = page.locator("#precos").getByRole("link", {
      name: /começar \d+ dias grátis|começar.*grátis/i,
    });
    await expect(ctaPreco.first()).toBeVisible({ timeout: 8000 });
    await ctaPreco.first().click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("landing pt-BR: link 'Entrar' deve levar para /login", async ({
    page,
  }) => {
    await page.goto(`/${BASE_LOCALE}`);
    const entrar = page.getByRole("link", { name: /^entrar$/i });
    await expect(entrar.first()).toBeVisible({ timeout: 8000 });
    await entrar.first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});
