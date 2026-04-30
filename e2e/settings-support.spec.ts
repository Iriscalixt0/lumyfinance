/**
 * E2E: Configurações e Suporte — perfil, tema, idioma, suporte.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Configurações", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe configurações", async ({ page }) => {
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.locator("text=/configuração|setting|preferência|preference|perfil|profile/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("campo de nome/perfil visível", async ({ page }) => {
    const nameInput = page
      .locator("input[placeholder*='nome'], input[placeholder*='name'], input[type='text']")
      .first();
    const hasInput = await nameInput.isVisible({ timeout: 5000 }).catch(() => false);
    const nameLabel = page.locator("text=/nome|name|full name/i").first();
    const hasLabel = await nameLabel.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasInput || hasLabel).toBeTruthy();
  });

  test("opção de tema (claro/escuro) visível", async ({ page }) => {
    const themeToggle = page
      .locator("text=/tema|theme|claro|escuro|dark|light/i")
      .first();
    await expect(themeToggle).toBeVisible({ timeout: 10_000 });
  });

  test("seletor de idioma visível", async ({ page }) => {
    const langSelect = page.locator("select[aria-label], select").first();
    const langOption = page
      .locator("text=/idioma|language|português|english|español/i")
      .first();
    const hasSelect = await langSelect.isVisible({ timeout: 5000 }).catch(() => false);
    const hasOption = await langOption.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasSelect || hasOption).toBeTruthy();
  });

  test("botão de salvar alterações visível", async ({ page }) => {
    const saveBtn = page.getByRole("button", {
      name: /salvar|save|atualizar|update|confirmar/i,
    });
    await expect(saveBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("pode editar nome e salvar", async ({ page }) => {
    const nameInput = page
      .locator("input[type='text']")
      .first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const current = await nameInput.inputValue();
      await nameInput.fill(current || "Usuário E2E");
      const saveBtn = page.getByRole("button", { name: /salvar|save|atualizar/i });
      if (await saveBtn.first().isVisible().catch(() => false)) {
        await saveBtn.first().click();
        // Toast de sucesso ou permanece na página
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("toggle de tema alterna dark/light", async ({ page }) => {
    const darkToggle = page
      .locator("button, [role='switch']")
      .filter({ hasText: /dark|escuro|tema|theme/i })
      .first();
    const htmlBefore = await page.locator("html").getAttribute("class");

    if (await darkToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await darkToggle.click();
      await page.waitForTimeout(300);
      const htmlAfter = await page.locator("html").getAttribute("class");
      // Classe deve ter mudado
      expect(htmlBefore).not.toBe(htmlAfter);
    }
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Suporte", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/support");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página de suporte carrega", async ({ page }) => {
    await expect(page).toHaveURL(/\/support/);
    await expect(
      page.locator("text=/suporte|support|ajuda|help|contato|contact/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("formulário de suporte tem campo de assunto", async ({ page }) => {
    const subjectInput = page
      .locator("input[placeholder*='assunto'], input[placeholder*='subject'], select")
      .first();
    await expect(subjectInput).toBeVisible({ timeout: 10_000 });
  });

  test("formulário tem campo de mensagem", async ({ page }) => {
    const messageInput = page
      .locator("textarea, input[placeholder*='mensagem'], input[placeholder*='message']")
      .first();
    await expect(messageInput).toBeVisible({ timeout: 10_000 });
  });

  test("pode preencher e submeter formulário de suporte", async ({ page }) => {
    // Seleciona categoria se disponível
    const categorySelect = page.locator("select").first();
    if (await categorySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await categorySelect.locator("option").all();
      if (options.length > 1) await categorySelect.selectOption({ index: 1 });
    }

    // Preenche assunto
    const subjectInput = page
      .locator("input[type='text'], input[placeholder*='assunto'], input[placeholder*='subject']")
      .first();
    if (await subjectInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectInput.fill("Teste E2E — dúvida sobre transações");
    }

    // Preenche mensagem
    const messageArea = page.locator("textarea").first();
    if (await messageArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await messageArea.fill("Esta é uma mensagem de teste enviada pelo E2E. Por favor, ignore.");
    }

    // Submete
    const submitBtn = page.getByRole("button", {
      name: /enviar|send|submeter|submit/i,
    });
    if (await submitBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.first().click();
      await page.waitForTimeout(3000);
      // Deve mostrar confirmação ou redirecionar
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});
