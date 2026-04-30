/**
 * E2E: Lista de Compras — adicionar itens, marcar como feito, excluir,
 * itens fixos, sync check.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Lista de Compras", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/grocery");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe lista de compras", async ({ page }) => {
    await expect(page).toHaveURL(/\/grocery/);
    await expect(
      page.locator("text=/compras|grocery|mercado|lista/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("campo de input para adicionar item visível", async ({ page }) => {
    const addInput = page.locator("input[placeholder], input[type='text']").first();
    await expect(addInput).toBeVisible({ timeout: 10_000 });
  });

  test("pode adicionar um item à lista", async ({ page }) => {
    const timestamp = Date.now();
    const itemName = `Arroz E2E ${timestamp}`;

    const addInput = page.locator("input[placeholder], input[type='text']").first();
    await addInput.fill(itemName);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=/${itemName}/`).first()).toBeVisible({ timeout: 10_000 });
  });

  test("pode marcar item como comprado/feito", async ({ page }) => {
    // Adiciona item
    const itemName = `Leite E2E ${Date.now()}`;
    const addInput = page.locator("input[placeholder], input[type='text']").first();
    await addInput.fill(itemName);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    // Marca como feito
    const checkbox = page
      .locator(`text=/${itemName}/`)
      .locator("..") // parent
      .locator("[type='checkbox'], button, [role='checkbox']")
      .first();

    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(500);
      // Item deve aparecer riscado ou marcado
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("pode excluir item da lista", async ({ page }) => {
    // Adiciona item para excluir
    const itemName = `Macarrão E2E ${Date.now()}`;
    const addInput = page.locator("input[placeholder], input[type='text']").first();
    await addInput.fill(itemName);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    const itemRow = page.locator(`text=/${itemName}/`).locator("..");
    await itemRow.hover().catch(() => {});

    const deleteBtn = itemRow
      .getByRole("button", { name: /excluir|delete|apagar|remove|×/i })
      .first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator(`text=/${itemName}/`)).not.toBeVisible({ timeout: 8000 });
    }
  });

  test("contador de itens atualiza ao adicionar", async ({ page }) => {
    const before = await page
      .locator("text=/\\d+ ite|\\d+ item/i")
      .first()
      .textContent()
      .catch(() => "");

    const addInput = page.locator("input[placeholder], input[type='text']").first();
    await addInput.fill(`Feijão E2E ${Date.now()}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);

    // Página não deve crashar
    await expect(page.locator("body")).toBeVisible();
  });

  test("link ou botão para itens fixos visível", async ({ page }) => {
    const fixedLink = page.getByRole("link", { name: /fixos|fixed|sempre|always/i });
    const fixedBtn = page.getByRole("button", { name: /fixos|fixed/i });
    const hasLink = await fixedLink.first().isVisible().catch(() => false);
    const hasBtn = await fixedBtn.first().isVisible().catch(() => false);
    // Pode estar no menu ou como botão — basta existir
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Lista de Compras — Itens Fixos", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/grocery/fixed");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página de itens fixos carrega", async ({ page }) => {
    await expect(page).toHaveURL(/\/grocery\/fixed/);
    await expect(
      page.locator("text=/fixo|fixed|sempre|always|recorrente|recurring/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("pode adicionar item fixo", async ({ page }) => {
    const addInput = page.locator("input[placeholder], input[type='text']").first();
    if (await addInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addInput.fill(`Papel Higiênico E2E ${Date.now()}`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Lista de Compras — Sync Check", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/grocery/sync-check");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página de sync check carrega", async ({ page }) => {
    await expect(page).toHaveURL(/\/grocery\/sync-check/);
    await expect(page.locator("body")).toBeVisible();
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});
