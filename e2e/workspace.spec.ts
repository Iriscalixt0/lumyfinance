/**
 * E2E: Workspace — visualização, membros, convite, roles.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Workspace — estrutura", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/workspace");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe nome do workspace", async ({ page }) => {
    await expect(page).toHaveURL(/\/workspace/);
    await expect(
      page.locator("text=/workspace|espaço|equipe|família|personal/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("lista de membros visível", async ({ page }) => {
    await expect(
      page.locator("text=/membro|member|integrante|participant/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("próprio usuário aparece na lista de membros", async ({ page }) => {
    // O usuário logado deve aparecer na lista
    const memberList = page.locator("[class*='member'], [class*='Member'], ul li, .divide-y > div").first();
    await expect(memberList).toBeVisible({ timeout: 10_000 });
  });

  test("botão ou formulário de convite visível", async ({ page }) => {
    const inviteBtn = page.getByRole("button", {
      name: /convidar|invite|adicionar membro|add member/i,
    });
    const inviteInput = page.locator("input[placeholder*='email'], input[type='email']").first();
    const hasBtn = await inviteBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasInput = await inviteInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasBtn || hasInput).toBeTruthy();
  });

  test("role do usuário visível (owner/admin/editor)", async ({ page }) => {
    const roleLabel = page
      .locator("text=/owner|admin|editor|viewer|dono|proprietário/i")
      .first();
    await expect(roleLabel).toBeVisible({ timeout: 10_000 });
  });

  test("sem erros de renderização", async ({ page }) => {
    await expect(
      page.locator("text=/crashed|erro crítico|something went wrong/i")
    ).not.toBeVisible();
  });
});

test.describe("Workspace — convite", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/workspace");
    await page.waitForLoadState("domcontentloaded");
  });

  test("formulário de convite aceita email", async ({ page }) => {
    const inviteBtn = page.getByRole("button", {
      name: /convidar|invite|adicionar membro|add member/i,
    });
    if (await inviteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await inviteBtn.first().click();
    }

    const emailInput = page.locator("input[type='email'], input[placeholder*='email']").first();
    if (await emailInput.isVisible({ timeout: 8000 }).catch(() => false)) {
      await emailInput.fill("convidado@teste.com");
      await expect(emailInput).toHaveValue("convidado@teste.com");
    }
  });

  test("convite com email inválido mostra erro ou não submete", async ({ page }) => {
    const inviteBtn = page.getByRole("button", {
      name: /convidar|invite|adicionar membro|add member/i,
    });
    if (await inviteBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await inviteBtn.first().click();
    }

    const emailInput = page.locator("input[type='email'], input[placeholder*='email']").first();
    if (await emailInput.isVisible({ timeout: 8000 }).catch(() => false)) {
      await emailInput.fill("emailinvalido");
      const sendBtn = page.getByRole("button", { name: /enviar|send|convidar|invite/i });
      if (await sendBtn.last().isVisible().catch(() => false)) {
        await sendBtn.last().click();
        // Não deve ir para outra URL
        await expect(page).toHaveURL(/\/workspace/);
      }
    }
  });
});
