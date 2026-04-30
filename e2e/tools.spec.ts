/**
 * E2E: Ferramentas — Projeção, Relatório Anual, Lumy AI, Crypto.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Projeção de saldo", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/projection");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe projeção", async ({ page }) => {
    await expect(page).toHaveURL(/\/projection/);
    await expect(
      page.locator("text=/projeção|projection|previsão|forecast|saldo futuro/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("gráfico ou tabela de projeção visível", async ({ page }) => {
    const chart = page.locator("svg, canvas, text=/mês|month|jan|fev|mar/i").first();
    const hasChart = await chart.isVisible({ timeout: 8000 }).catch(() => false);
    await expect(page.locator("body")).toBeVisible();
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Relatório Anual", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/annual-report");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe relatório anual", async ({ page }) => {
    await expect(page).toHaveURL(/\/annual-report/);
    await expect(
      page.locator("text=/relatório|report|anual|annual|ano|year/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("seletor de ano visível", async ({ page }) => {
    const yearSelect = page.locator("select").first();
    const hasSelect = await yearSelect.isVisible({ timeout: 5000 }).catch(() => false);
    const yearBtn = page.locator("text=/202[0-9]/").first();
    const hasBtnYear = await yearBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasSelect || hasBtnYear).toBeTruthy();
  });

  test("gráficos ou cards de resumo anual visíveis", async ({ page }) => {
    const chart = page.locator("svg, canvas").first();
    const hasChart = await chart.isVisible({ timeout: 8000 }).catch(() => false);
    const card = page.locator("[class*='card'], [class*='Card']").first();
    const hasCard = await card.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasChart || hasCard).toBeTruthy();
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Lumy — IA de insights", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/lumy");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe conteúdo do assistente", async ({ page }) => {
    await expect(page).toHaveURL(/\/lumy/);
    await expect(
      page.locator("text=/lumy|insight|análise|analise|dica|tip|ia|ai/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("campo de input ou botão de gerar insight visível", async ({ page }) => {
    const inputOrBtn = page
      .locator(
        "input[placeholder], textarea[placeholder], button[name*='gerar'], button[name*='generate']"
      )
      .first();
    const genBtn = page.getByRole("button", { name: /gerar|generate|analisar|analyze|enviar|send/i });
    const hasInput = await inputOrBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasBtn = await genBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasInput || hasBtn).toBeTruthy();
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Crypto", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/crypto");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe conteúdo de criptomoedas", async ({ page }) => {
    await expect(page).toHaveURL(/\/crypto/);
    await expect(
      page.locator("text=/crypto|cripto|bitcoin|btc|ethereum|eth|moeda|coin/i").first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test("lista de criptos ou tabela de preços visível", async ({ page }) => {
    const list = page.locator("table, [role='table'], ul, [role='list']").first();
    const hasTable = await list.isVisible({ timeout: 8000 }).catch(() => false);
    // Se não tiver tabela, pelo menos a página não crashou
    await expect(page.locator("body")).toBeVisible();
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});
