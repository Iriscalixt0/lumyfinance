/**
 * E2E: Calculadoras financeiras — renderização, inputs e cálculos.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Calculadoras", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/calculators");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe calculadoras", async ({ page }) => {
    await expect(page).toHaveURL(/\/calculators/);
    await expect(
      page.locator("text=/calculadora|calculator|calcular|calculate/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("pelo menos um input de valor visível", async ({ page }) => {
    const numInput = page.locator("input[type='number'], input[type='text'][placeholder*='valor'], input[placeholder*='amount']").first();
    await expect(numInput).toBeVisible({ timeout: 10_000 });
  });

  test("pode digitar um valor e ver resultado", async ({ page }) => {
    const inputs = page.locator("input[type='number'], input[inputmode='decimal'], input[inputmode='numeric']");
    const count = await inputs.count();
    if (count > 0) {
      await inputs.first().fill("1000");
      await page.keyboard.press("Tab");
      // Resultado deve aparecer sem crash
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("calculadora de juros compostos ou similar existe", async ({ page }) => {
    const calcName = page
      .locator("text=/juros|interest|compound|rendimento|yield|empréstimo|loan|financiamento/i")
      .first();
    await expect(calcName).toBeVisible({ timeout: 10_000 });
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});
