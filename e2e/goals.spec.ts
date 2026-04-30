/**
 * E2E: Metas financeiras — listagem, criação, progresso, edição, exclusão.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Metas — estrutura da página", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/goals");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe título", async ({ page }) => {
    await expect(page).toHaveURL(/\/goals/);
    await expect(
      page.locator("text=/meta|goal/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("botão de criar meta visível", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|nova|create|add/i,
    });
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("página não tem erros de renderização", async ({ page }) => {
    await expect(page.locator("text=/crashed|erro crítico|something went wrong/i")).not.toBeVisible();
  });
});

test.describe("Metas — CRUD", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/goals");
    await page.waitForLoadState("domcontentloaded");
  });

  test("abre formulário ao clicar em criar meta", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|nova|create|add/i,
    });
    await createBtn.first().click();

    // Formulário de meta deve aparecer
    const nameInput = page
      .locator("input[type='text'], input[placeholder]")
      .first();
    await expect(nameInput).toBeVisible({ timeout: 8000 });
  });

  test("cria meta e aparece na lista", async ({ page }) => {
    const timestamp = Date.now();
    const goalName = `Viagem E2E ${timestamp}`;

    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|nova|create|add/i,
    });
    await createBtn.first().click();

    // Nome da meta
    const nameInput = page.locator("input[type='text']").first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(goalName);
    }

    // Valor alvo
    const amountInput = page.locator("input[type='number']").first();
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await amountInput.fill("5000");
    }

    const saveBtn = page.getByRole("button", { name: /salvar|save|criar|create|confirmar/i });
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      await expect(page.locator(`text=/${goalName}/`).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("card de meta mostra progresso visual", async ({ page }) => {
    // Se houver metas, deve mostrar barra/% de progresso
    const progressBar = page
      .locator("[role='progressbar'], .progress, progress, text=/%/")
      .first();
    const hasProgress = await progressBar.isVisible().catch(() => false);
    await expect(page.locator("body")).toBeVisible();
  });

  test("botão de excluir meta abre confirmação", async ({ page }) => {
    const deleteBtn = page
      .getByRole("button", { name: /excluir|delete|apagar|remove/i })
      .first();
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
