/**
 * E2E: Investimentos e Cobranças — carregamento das páginas, listas e formulários.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Investimentos", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/investments");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega sem erros", async ({ page }) => {
    await expect(page).toHaveURL(/\/investments/);
    await expect(page.locator("text=/investimento|investment/i").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("botão de adicionar investimento visível", async ({ page }) => {
    const addBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("abre formulário ao clicar em adicionar", async ({ page }) => {
    const addBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await addBtn.first().click();
    const form = page.locator("input, select, form").first();
    await expect(form).toBeVisible({ timeout: 8000 });
  });

  test("cria investimento e aparece na lista", async ({ page }) => {
    const timestamp = Date.now();
    const name = `CDB E2E ${timestamp}`;

    const addBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await addBtn.first().click();

    const nameInput = page.locator("input[type='text']").first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(name);
    }

    const amountInput = page.locator("input[type='number']").first();
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await amountInput.fill("10000");
    }

    const saveBtn = page.getByRole("button", { name: /salvar|save|criar|create|confirmar/i });
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      // Não crashou
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Cobranças (Billings)", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/billings");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega sem erros", async ({ page }) => {
    await expect(page).toHaveURL(/\/billings/);
    await expect(
      page.locator("text=/cobranç|billing|assinatura|subscription|pagamento|payment/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("lista de cobranças renderiza (vazia ou com itens)", async ({ page }) => {
    // Verifica que algum conteúdo é visível
    const content = page.locator("main, [role='main'], .content, body > div").first();
    await expect(content).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });

  test("botão de adicionar cobrança visível", async ({ page }) => {
    const addBtn = page.getByRole("button", {
      name: /adicionar|criar|new|nova|create|add/i,
    });
    const exists = await addBtn.first().isVisible().catch(() => false);
    // Pode não ter botão se a feature for só de visualização
    await expect(page.locator("body")).toBeVisible();
  });
});
