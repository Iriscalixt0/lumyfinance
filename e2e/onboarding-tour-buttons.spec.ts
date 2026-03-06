import { expect, test, type Page } from "@playwright/test";

const TOUR_STORAGE_KEY = "nf_tour_pending";
const E2E_ONBOARDING_EMAIL = process.env.E2E_ONBOARDING_EMAIL;
const E2E_ONBOARDING_PASSWORD = process.env.E2E_ONBOARDING_PASSWORD;

async function loginAndOpenTour(page: Page) {
  if (!E2E_ONBOARDING_EMAIL || !E2E_ONBOARDING_PASSWORD) {
    test.skip(true, "Set E2E_ONBOARDING_EMAIL and E2E_ONBOARDING_PASSWORD.");
  }

  await page.goto("/login");
  await page.getByPlaceholder(/email|e-mail/i).fill(E2E_ONBOARDING_EMAIL!);
  await page.getByPlaceholder(/senha|password/i).fill(E2E_ONBOARDING_PASSWORD!);
  await page.getByRole("button", { name: /entrar|login|sign in/i }).click();

  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 25_000 });

  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /Pessoal|Personal/i }).first().click();
    const continueBtn = page.getByRole("button", { name: /Continuar|Continue/i });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await page.evaluate((key) => sessionStorage.setItem(key, "1"), TOUR_STORAGE_KEY);
  await page.goto("/dashboard");
  await expect(page.locator(".driver-popover")).toBeVisible({ timeout: 10_000 });
}

test.describe("Onboarding tour actions", () => {
  test.describe.configure({ timeout: 120_000, retries: 1 });
  test.beforeEach(() => {
    test.skip(
      process.env.E2E_RUN_ONBOARDING_TOUR !== "1",
      "Set E2E_RUN_ONBOARDING_TOUR=1 to run"
    );
  });

  test("renders X + Next on popover", async ({ page }) => {
    await loginAndOpenTour(page);
    await expect(page.locator(".driver-popover")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".driver-popover-close-btn").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Pr[oó]ximo|Next|Siguiente/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("X button closes tour without redirect", async ({ page }) => {
    await loginAndOpenTour(page);
    const beforePath = new URL(page.url()).pathname;
    const closeBtn = page.locator(".driver-popover-close-btn").first();
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });
    await closeBtn.click();
    await expect(page.locator(".driver-popover")).not.toBeVisible({ timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(beforePath);
  });
});
