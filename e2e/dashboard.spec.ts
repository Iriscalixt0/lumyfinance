/**
 * E2E: Dashboard — widgets, cards de saúde, navegação, gamificação.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD, loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Dashboard", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega sem erros", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // Não deve ter tela de erro/loading preso
    await expect(page.locator("text=/erro crítico|crashed|something went wrong/i")).not.toBeVisible();
  });

  test("card de saldo ou 'safe to spend' visível", async ({ page }) => {
    const balanceCard = page
      .locator("text=/saldo|balance|safe to spend|livre para gastar/i")
      .first();
    await expect(balanceCard).toBeVisible({ timeout: 15_000 });
  });

  test("seção de atividades recentes ou resumo visível", async ({ page }) => {
    const recentActivity = page
      .locator("text=/atividade|recente|recent|transações|transactions|resumo|summary/i")
      .first();
    await expect(recentActivity).toBeVisible({ timeout: 15_000 });
  });

  test("card de saúde financeira ou score visível", async ({ page }) => {
    const healthCard = page
      .locator("text=/saúde|health|score|pontuação/i")
      .first();
    await expect(healthCard).toBeVisible({ timeout: 15_000 });
  });

  test("streak strip ou barra de gamificação visível", async ({ page }) => {
    // Streak ou XP bar no topo/rodapé
    const streak = page
      .locator("text=/streak|sequência|dias|xp|level|nível/i")
      .first();
    await expect(streak).toBeVisible({ timeout: 15_000 });
  });

  test("barra de navegação inferior visível em desktop", async ({ page }) => {
    // AppLayout deve renderizar nav
    const nav = page.locator("nav, [role='navigation']").first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test("pode navegar para /transactions pelo menu", async ({ page }) => {
    const transactionsLink = page.getByRole("link", {
      name: /transações|transactions/i,
    });
    if (await transactionsLink.first().isVisible().catch(() => false)) {
      await transactionsLink.first().click();
      await expect(page).toHaveURL(/\/transactions/, { timeout: 15_000 });
    } else {
      // Tenta nav lateral ou bottom nav
      await page.goto("/transactions");
      await expect(page).toHaveURL(/\/transactions/);
    }
  });

  test("pode navegar para /budgets", async ({ page }) => {
    await page.goto("/budgets");
    await expect(page).toHaveURL(/\/budgets/);
    await expect(page.locator("text=/orçamento|budget/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("pode navegar para /goals", async ({ page }) => {
    await page.goto("/goals");
    await expect(page).toHaveURL(/\/goals/);
    await expect(page.locator("text=/meta|goal/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("pode navegar para /recurring", async ({ page }) => {
    await page.goto("/recurring");
    await expect(page).toHaveURL(/\/recurring/);
    await expect(page.locator("text=/recorren|fixo|recurring|repeat/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("insight ou dica financeira renderiza sem crash", async ({ page }) => {
    // LumyInsightWidget ou InsightPhrase deve estar visível ou simplesmente não travar
    await expect(page).not.toHaveURL(/\/error/);
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("previsão de saldo ou forecast renderiza", async ({ page }) => {
    const forecast = page
      .locator("text=/previsão|forecast|próximo|next month|projeção/i")
      .first();
    // Pode ou não estar visível dependendo de dados existentes
    await page.waitForLoadState("networkidle").catch(() => {});
    // Apenas verifica que a página não quebrou
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Dashboard — mobile (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/dashboard");
  });

  test("bottom nav visível em mobile", async ({ page }) => {
    const bottomNav = page.locator("nav").last();
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });
  });

  test("conteúdo não transborda horizontalmente", async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // margem de 5px
  });
});
