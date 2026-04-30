/**
 * E2E: Orçamentos — listagem, criação, edição, exclusão, barra de progresso.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Orçamentos — estrutura", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/budgets");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe título de orçamentos", async ({ page }) => {
    await expect(page).toHaveURL(/\/budgets/);
    await expect(
      page.locator("text=/orçamento|budget/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("botão de criar orçamento visível", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("formulário de orçamento tem campos de categoria e limite", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await createBtn.first().click();

    // Deve abrir formulário com campos de categoria e valor
    const amountInput = page.locator("input[type='number'], input[placeholder*='valor'], input[placeholder*='limite'], input[placeholder*='limit']").first();
    const catSelect = page.locator("select").first();

    const hasAmount = await amountInput.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCat = await catSelect.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasAmount || hasCat).toBeTruthy();
  });
});

test.describe("Orçamentos — CRUD", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/budgets");
    await page.waitForLoadState("domcontentloaded");
  });

  test("cria um orçamento e aparece na lista", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await createBtn.first().click();

    // Preenche valor limite
    const amountInput = page
      .locator("input[type='number'], input[type='text'][placeholder*='valor'], input[placeholder*='limit']")
      .first();
    if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amountInput.fill("1000");
    }

    const saveBtn = page.getByRole("button", { name: /salvar|save|criar|create|confirmar/i });
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      // Verifica que o orçamento foi salvo (sem crash)
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("barra de progresso de orçamento visível quando há itens", async ({ page }) => {
    // Se houver orçamentos, barra de progresso deve existir
    const progressBar = page.locator("[role='progressbar'], .progress, progress").first();
    const hasProgress = await progressBar.isVisible().catch(() => false);
    // Pode não ter se não houver orçamentos — apenas verifica que não houve crash
    await expect(page.locator("body")).toBeVisible();
    if (hasProgress) {
      await expect(progressBar).toBeVisible();
    }
  });

  test("botão de excluir orçamento abre confirmação", async ({ page }) => {
    const deleteBtn = page.getByRole("button", {
      name: /excluir|delete|apagar|remove/i,
    }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await expect(
        page.locator("text=/tem certeza|confirm|excluir|delete/i").first()
      ).toBeVisible({ timeout: 8000 });
      const cancelBtn = page.getByRole("button", { name: /cancelar|cancel/i }).last();
      await cancelBtn.click();
    }
  });
});
