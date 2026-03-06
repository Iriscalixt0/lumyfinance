import { expect, test } from "@playwright/test";

test.describe("Routing & i18n", () => {
  test("landing page loads with Lumyf branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Lumyf")).toBeVisible({ timeout: 8000 });
  });

  test("login page renders email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("register page renders form fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("dashboard without session redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("onboarding without session redirects to /login", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("transactions without session redirects to /login", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("settings without session redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("unknown route shows landing page", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.getByText("Lumyf")).toBeVisible({ timeout: 8000 });
  });

  test("locale switcher is visible on landing page", async ({ page }) => {
    await page.goto("/");
    // The locale switcher should be visible in the header
    const switcher = page.locator("button").filter({ hasText: /🇧🇷|🇺🇸|🇪🇸|🇫🇷|🇩🇪/ });
    await expect(switcher.first()).toBeVisible({ timeout: 8000 });
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.getByRole("link", { name: /criar conta|create account|registrar/i });
    await expect(registerLink).toBeVisible({ timeout: 8000 });
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
  });
});
