import { expect, test, type Page } from "@playwright/test";

const BASE_LOCALE = "pt-BR";
const TOUR_STORAGE_KEY = "nf_tour_pending";
const E2E_ONBOARDING_EMAIL = process.env.E2E_ONBOARDING_EMAIL;
const E2E_ONBOARDING_PASSWORD = process.env.E2E_ONBOARDING_PASSWORD;

async function loginAndOpenTour(page: Page) {
  if (!E2E_ONBOARDING_EMAIL || !E2E_ONBOARDING_PASSWORD) {
    test.skip(true, "Defina E2E_ONBOARDING_EMAIL e E2E_ONBOARDING_PASSWORD.");
  }

  await page.goto(`/${BASE_LOCALE}/login`);
  await page.getByPlaceholder(/email|e-mail/i).fill(E2E_ONBOARDING_EMAIL!);
  await page.getByPlaceholder(/senha|password/i).fill(E2E_ONBOARDING_PASSWORD!);
  await page.getByRole("button", { name: /entrar|login|sign in/i }).click();

  await expect(page).toHaveURL(/\/(?:en|pt-BR|es|fr|de)\/(dashboard|onboarding)(?:\/|$)/, {
    timeout: 25_000,
  });

  const localeMatch = page.url().match(/\/(en|pt-BR|es|fr|de)(?:\/|$)/);
  const locale = localeMatch?.[1] ?? BASE_LOCALE;

  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /Pessoal|Personal/i }).first().click();
    const continueBtn = page.getByRole("button", { name: /Continuar|Continue/i });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();
  }

  await expect(page).toHaveURL(/\/(?:en|pt-BR|es|fr|de)\/dashboard(?:\/|$)/, { timeout: 20_000 });
  await page.evaluate((key) => sessionStorage.setItem(key, "1"), TOUR_STORAGE_KEY);
  await page.goto(`/${locale}/dashboard`);
  await expect(page.locator(".driver-popover")).toBeVisible({ timeout: 10_000 });
}

test.describe("Onboarding tour actions", () => {
  test.describe.configure({ timeout: 120_000, retries: 1 });
  test.beforeEach(() => {
    test.skip(
      process.env.E2E_RUN_ONBOARDING_TOUR !== "1",
      "Defina E2E_RUN_ONBOARDING_TOUR=1 para rodar este fluxo E2E."
    );
  });

  test("renderiza apenas X + Proximo no popover", async ({ page }) => {
    await loginAndOpenTour(page);

    await expect(page.locator(".driver-popover")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".driver-popover-close-btn").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Pr[oó]ximo|Next|Siguiente/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.locator(".driver-popover-prev-btn")).toHaveCount(0);
    await expect(page.locator("[data-tour-fechar='1']")).toHaveCount(0);
  });

  test("botao X fecha o tour sem redirecionar", async ({ page }) => {
    await loginAndOpenTour(page);
    const beforePath = new URL(page.url()).pathname;

    const closeBtn = page.locator(".driver-popover-close-btn").first();
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });
    await closeBtn.click();

    await expect(page.locator(".driver-popover")).not.toBeVisible({ timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(beforePath);
  });

  test("ultimo Proximo finaliza o tour sem redirecionar", async ({ page }) => {
    await loginAndOpenTour(page);
    const beforePath = new URL(page.url()).pathname;

    for (let i = 0; i < 30; i += 1) {
      const popoverVisible = await page.locator(".driver-popover").isVisible().catch(() => false);
      if (!popoverVisible) {
        break;
      }

      const nextBtn = page.getByRole("button", { name: /Pr[oó]ximo|Next|Siguiente/i }).first();
      if (!(await nextBtn.isVisible().catch(() => false))) {
        break;
      }
      await nextBtn.click();
    }

    await expect(page.locator(".driver-popover")).not.toBeVisible({ timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe(beforePath);
  });
});
