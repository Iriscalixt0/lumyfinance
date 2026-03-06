import { expect, test } from "@playwright/test";

test.describe("Locale Switcher", () => {
  test.beforeEach(async ({ page }) => {
    // Clear locale preference so detection doesn't interfere
    await page.addInitScript(() => localStorage.removeItem("lumyf-locale"));
    await page.goto("/");
    await page.waitForTimeout(1000);
  });

  test("locale switcher select is visible on landing page", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await expect(switcher).toBeVisible({ timeout: 8000 });
  });

  test("switching to English updates interface text", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await switcher.selectOption("en");
    await page.waitForTimeout(500);

    // The landing page should now show English text
    await expect(page.getByText(/Sign up free|Get started|Start/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("switching to Spanish updates interface text", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await switcher.selectOption("es");
    await page.waitForTimeout(500);

    await expect(page.getByText(/Registrarse|Comenzar|Gratis/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("switching to French updates interface text", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await switcher.selectOption("fr");
    await page.waitForTimeout(500);

    await expect(page.getByText(/S'inscrire|Commencer|Gratuit/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("switching to German updates interface text", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await switcher.selectOption("de");
    await page.waitForTimeout(500);

    await expect(page.getByText(/Registrieren|Starten|Kostenlos/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("locale preference persists after page reload", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await switcher.selectOption("en");
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForTimeout(1000);

    // After reload, should still be in English
    const currentValue = await page.locator("select[aria-label]").first().inputValue();
    expect(currentValue).toBe("en");
  });

  test("switching locale updates the html lang attribute", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    await switcher.selectOption("de");
    await page.waitForTimeout(500);

    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("de");
  });

  test("switching back to pt-BR restores Portuguese text", async ({ page }) => {
    const switcher = page.locator("select[aria-label]").first();
    // Switch to English first
    await switcher.selectOption("en");
    await page.waitForTimeout(500);
    // Switch back to pt-BR
    await switcher.selectOption("pt-BR");
    await page.waitForTimeout(500);

    await expect(page.getByText(/Cadastre-se|Começar|Grátis/i).first()).toBeVisible({ timeout: 5000 });
  });
});
