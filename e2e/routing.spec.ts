import { expect, test } from "@playwright/test";

test.describe("Routing e localization", () => {
  test("deve abrir login em pt-BR", async ({ page }) => {
    await page.goto("/pt-BR/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page).toHaveURL(/\/pt-BR\/login/);
  });

  test("deve abrir login em en", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("deve abrir register em pt-BR sem erro", async ({ page }) => {
    await page.goto("/pt-BR/register");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page).toHaveURL(/\/pt-BR\/register/);
  });

  test("landing pt-BR deve carregar", async ({ page }) => {
    await page.goto("/pt-BR");
    await expect(page.getByRole("link", { name: /entrar|login/i })).toBeVisible({ timeout: 8000 });
  });

  test("dashboard sem sessao deve redirecionar para login pt-BR", async ({ page }) => {
    await page.goto("/pt-BR/dashboard");
    await expect(page).toHaveURL(/\/pt-BR\/login/);
  });

  test("dashboard sem sessao deve redirecionar para login en", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("onboarding sem sessao deve redirecionar para login", async ({ page }) => {
    await page.goto("/pt-BR/onboarding");
    await expect(page).toHaveURL(/\/pt-BR\/login/);
  });

  test("api de cobrancas export-csv nao deve retornar 404", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/cobrancas/export-csv`);
    expect(response.status(), `status foi ${response.status()}`).not.toBe(404);
  });

  test("api set-workspace nao deve retornar 404", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/set-workspace`, {
      data: {},
    });
    expect(response.status(), `status foi ${response.status()}`).not.toBe(404);
  });
});

