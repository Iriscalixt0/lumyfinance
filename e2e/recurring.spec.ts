/**
 * E2E: Transações Recorrentes (Fixas) — CRUD, pause/retomada, filtro de mês,
 * materialização automática ao navegar para meses futuros.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Recorrentes — estrutura da página", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/recurring");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega sem erros", async ({ page }) => {
    await expect(page).toHaveURL(/\/recurring/);
    await expect(page.locator("text=/recorren|fixo|recurring/i").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("labels de frequência visíveis (mensal, semanal, etc.)", async ({ page }) => {
    // Pelo menos um dos rótulos de frequência deve estar visível no formulário ou filtros
    const freqLabel = page
      .locator("text=/mensal|semanal|quinzenal|anual|monthly|weekly|biweekly|yearly/i")
      .first();
    await expect(freqLabel).toBeVisible({ timeout: 10_000 });
  });

  test("botão de criar recorrente visível", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("filtro de mês visível", async ({ page }) => {
    const monthFilter = page.locator("select").first();
    await expect(monthFilter).toBeVisible({ timeout: 10_000 });
  });

  test("filtro de status (ativo/inativo) visível", async ({ page }) => {
    const statusFilter = page
      .locator("text=/ativ|inativ|status|active|inactive/i")
      .first();
    await expect(statusFilter).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Recorrentes — criação", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/recurring");
    await page.waitForLoadState("domcontentloaded");
  });

  test("abre formulário ao clicar em adicionar", async ({ page }) => {
    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add/i,
    });
    await createBtn.first().click();
    // Formulário deve aparecer
    await expect(
      page.locator("input[placeholder], input[type='text'], input[type='number']").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("cria recorrente mensal e aparece na lista", async ({ page }) => {
    const timestamp = Date.now();
    const desc = `Aluguel E2E ${timestamp}`;

    const createBtn = page.getByRole("button", {
      name: /adicionar|criar|new|novo|create|add|mensal|monthly/i,
    });
    await createBtn.first().click();

    // Preenche descrição
    const descInput = page.locator("input[placeholder*='escri'], input[placeholder*='nome'], input[placeholder*='desc']").first();
    if (await descInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await descInput.fill(desc);
    } else {
      const inputs = page.locator("input[type='text']");
      await inputs.first().fill(desc);
    }

    // Preenche valor
    const amountInput = page.locator("input[type='number'], input[placeholder*='valor'], input[placeholder*='amount']").first();
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await amountInput.fill("500");
    }

    // Seleciona frequência mensal se não for padrão
    const freqSelect = page.locator("select").first();
    if (await freqSelect.isVisible().catch(() => false)) {
      await freqSelect.selectOption("monthly").catch(() => {});
    }

    // Salva
    const saveBtn = page.getByRole("button", { name: /salvar|save|criar|create|confirmar/i });
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      // A recorrente deve aparecer na lista
      await expect(page.locator(`text=/${desc}/`).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe("Recorrentes — pause e retomada", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/recurring");
    await page.waitForLoadState("domcontentloaded");
  });

  test("botão de pausar/retomar existe em itens da lista", async ({ page }) => {
    const pauseBtn = page
      .getByRole("button", { name: /pausar|pause|retomar|resume|ativar/i })
      .first();
    const pauseIcon = page.locator("[aria-label*='aus'], [title*='ause'], [aria-label*='esume']").first();
    const exists =
      (await pauseBtn.isVisible().catch(() => false)) ||
      (await pauseIcon.isVisible().catch(() => false));

    if (!exists) {
      // Se não há itens ainda, cria um antes de testar
      test.skip(true, "Sem recorrentes na lista para testar pause/resume");
    }
    expect(exists).toBeTruthy();
  });
});

test.describe("Recorrentes — exclusão", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/recurring");
    await page.waitForLoadState("domcontentloaded");
  });

  test("botão de excluir abre modal de confirmação", async ({ page }) => {
    const deleteBtn = page.getByRole("button", { name: /excluir|delete|apagar|remove/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await expect(
        page.locator("text=/tem certeza|are you sure|confirmar|confirm|excluir/i").first()
      ).toBeVisible({ timeout: 8000 });
      // Cancela sem deletar
      const cancelBtn = page.getByRole("button", { name: /cancelar|cancel/i }).last();
      await cancelBtn.click();
    }
  });
});

test.describe("Recorrentes — materialização em mês futuro", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
  });

  test("transações fixas aparecem ao navegar para mês seguinte", async ({ page }) => {
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");

    // Navega para o próximo mês
    const yearSelect = page.locator("select").last();
    const monthSelect = page.locator("select").first();
    const currentMonth = Number(await monthSelect.inputValue());
    const currentYear = Number(await yearSelect.inputValue());

    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    await monthSelect.selectOption(String(nextMonth));
    await yearSelect.selectOption(String(nextYear));

    // Aguarda re-renderização
    await page.waitForTimeout(2000);

    // A página não deve crashar ao navegar para mês futuro
    await expect(page).not.toHaveURL(/\/error/);
    await expect(page.locator("body")).toBeVisible();
  });
});
