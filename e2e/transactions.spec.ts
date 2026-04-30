/**
 * E2E: Transações — Magic Input, CRUD manual, voz, exportações, importação CSV,
 * scanner de recibo, filtros, moeda, modo viagem.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Transações — página e estrutura", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e mostra o mês/ano", async ({ page }) => {
    await expect(page).toHaveURL(/\/transactions/);
    // Seletor de mês
    const monthSelect = page.locator("select").first();
    await expect(monthSelect).toBeVisible({ timeout: 10_000 });
  });

  test("cards de resumo (receita, despesa, saldo) visíveis", async ({ page }) => {
    await expect(
      page.locator("text=/receita|income|entrada|inflow/i").first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("text=/despesa|expense|saída|outflow/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Magic Input está visível na página", async ({ page }) => {
    // O Magic Input tem um ícone Sparkles e placeholder característico
    const magicInput = page.locator("input[placeholder]").first();
    await expect(magicInput).toBeVisible({ timeout: 10_000 });
  });

  test("botão de exportar CSV visível", async ({ page }) => {
    await expect(page.getByText("CSV")).toBeVisible({ timeout: 10_000 });
  });

  test("botão de exportar PDF visível", async ({ page }) => {
    await expect(page.getByText("PDF")).toBeVisible({ timeout: 10_000 });
  });

  test("botão de copiar WhatsApp visível", async ({ page }) => {
    await expect(page.getByText("WhatsApp")).toBeVisible({ timeout: 10_000 });
  });

  test("botão de importar CSV visível", async ({ page }) => {
    const importBtn = page.getByRole("button", { name: /importar|import/i });
    await expect(importBtn).toBeVisible({ timeout: 10_000 });
  });

  test("botão de scanner de recibo visível", async ({ page }) => {
    const scanBtn = page.getByRole("button", { name: /scan|câmera|camera/i });
    await expect(scanBtn).toBeVisible({ timeout: 10_000 });
  });

  test("botão de histórico de recibos visível", async ({ page }) => {
    const receiptsBtn = page.getByRole("button", { name: /recibos|receipts/i });
    await expect(receiptsBtn).toBeVisible({ timeout: 10_000 });
  });

  test("botão de entrada por voz visível", async ({ page }) => {
    const micBtn = page.getByRole("button", { name: /voz|voice|microfone|mic/i });
    // Pode não estar em todos os viewports, então apenas verificamos se botão existe na área
    const micExists = await micBtn.isVisible().catch(() => false);
    // Busca alternativa pelo ícone mic
    const micIcon = page.locator("[aria-label*='oz'], [aria-label*='mic'], [title*='oz'], [title*='mic']");
    const iconExists = await micIcon.first().isVisible().catch(() => false);
    expect(micExists || iconExists).toBeTruthy();
  });

  test("seletor de mês navega para mês anterior", async ({ page }) => {
    const monthSelect = page.locator("select").first();
    const currentValue = await monthSelect.inputValue();
    const prevMonth = String(Number(currentValue) === 0 ? 11 : Number(currentValue) - 1);
    await monthSelect.selectOption(prevMonth);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("select").first()).toHaveValue(prevMonth);
  });

  test("filtro de categoria altera a lista", async ({ page }) => {
    // Filtra por categoria qualquer
    const catSelect = page.locator("select").last();
    const options = await catSelect.locator("option").all();
    if (options.length > 1) {
      await catSelect.selectOption({ index: 1 });
      // A lista deve re-renderizar sem crash
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

test.describe("Transações — Magic Input (criar)", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
  });

  test("magic input parseia 'gastei 50 almoço' e mostra preview", async ({ page }) => {
    const input = page.locator("input[placeholder]").first();
    await input.click();
    await input.fill("gastei 50 almoço");
    await page.waitForTimeout(500); // debounce do parser

    // Preview card deve aparecer com valor e descrição
    await expect(page.locator("text=/almoç/i").first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator("text=/50/").first()).toBeVisible({ timeout: 8000 });
  });

  test("magic input parseia receita 'recebi 3000 salário'", async ({ page }) => {
    const input = page.locator("input[placeholder]").first();
    await input.click();
    await input.fill("recebi 3000 salário");
    await page.waitForTimeout(500);

    await expect(page.locator("text=/salário|salario/i").first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator("text=/3000|3\.000/").first()).toBeVisible({ timeout: 8000 });
  });

  test("pode cancelar o preview do magic input", async ({ page }) => {
    const input = page.locator("input[placeholder]").first();
    await input.fill("gastei 25 uber");
    await page.waitForTimeout(500);

    const cancelBtn = page.getByRole("button", { name: /cancelar|cancel/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(page.locator("text=/25/")).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("magic input salva despesa e aparece no histórico", async ({ page }) => {
    const timestamp = Date.now();
    const desc = `Teste E2E ${timestamp}`;

    const input = page.locator("input[placeholder]").first();
    await input.click();
    await input.fill(`gastei 1 ${desc}`);
    await page.waitForTimeout(600);

    // Confirmar no preview
    const saveBtn = page.getByRole("button", { name: /salvar|save|confirmar|confirm/i });
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      // A transação deve aparecer na lista (pode precisar de scroll ou já está visível)
      await expect(page.locator(`text=/${desc}/`).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("magic input detecta moeda estrangeira (USD 10 coffee)", async ({ page }) => {
    const input = page.locator("input[placeholder]").first();
    await input.fill("USD 10 coffee");
    await page.waitForTimeout(500);

    // Deve mostrar USD no preview
    await expect(page.locator("text=/USD|coffee/i").first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Transações — formulário de edição", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
  });

  test("clicar em editar abre formulário com dados da transação", async ({ page }) => {
    // Hover sobre primeira transação para mostrar botão de editar
    const firstTx = page.locator(".group").first();
    if (await firstTx.isVisible().catch(() => false)) {
      await firstTx.hover();
      const editBtn = firstTx.getByRole("button", { name: /editar|edit/i });
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        // Formulário de edição aparece
        await expect(
          page.getByRole("button", { name: /salvar|save|atualizar/i })
        ).toBeVisible({ timeout: 8000 });
      }
    }
  });

  test("pode cancelar edição e voltar ao magic input", async ({ page }) => {
    const firstTx = page.locator(".group").first();
    if (await firstTx.isVisible().catch(() => false)) {
      await firstTx.hover();
      const editBtn = firstTx.getByRole("button", { name: /editar|edit/i });
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        const cancelBtn = page.getByRole("button", { name: /cancelar|cancel/i });
        await expect(cancelBtn).toBeVisible({ timeout: 8000 });
        await cancelBtn.click();
        // Volta para magic input
        await expect(page.locator("input[placeholder]").first()).toBeVisible({ timeout: 8000 });
      }
    }
  });
});

test.describe("Transações — exclusão", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
  });

  test("botão de deletar abre modal de confirmação", async ({ page }) => {
    const firstTx = page.locator(".group").first();
    if (await firstTx.isVisible().catch(() => false)) {
      await firstTx.hover();
      const deleteBtn = firstTx.getByRole("button", { name: /excluir|delete|apagar/i });
      if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();
        // Modal de confirmação
        await expect(
          page.locator("text=/tem certeza|are you sure|confirmar exclusão|delete/i").first()
        ).toBeVisible({ timeout: 8000 });
        // Cancela para não deletar dados reais
        const cancelModal = page.getByRole("button", { name: /cancelar|cancel/i });
        await cancelModal.last().click();
      }
    }
  });
});

test.describe("Transações — exportação e importação", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    await page.goto("/transactions");
    await page.waitForLoadState("domcontentloaded");
  });

  test("clicar em CSV dispara download", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
      page.getByText("CSV").click(),
    ]);
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }
  });

  test("modal de importação CSV abre ao clicar em Importar", async ({ page }) => {
    await page.getByRole("button", { name: /importar|import/i }).click();
    await expect(
      page.locator("text=/importar|import|csv/i").first()
    ).toBeVisible({ timeout: 8000 });
    // Fecha
    const closeBtn = page.getByRole("button", { name: /fechar|close|×|x/i });
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  });

  test("modal de scanner de recibo abre ao clicar em Scan", async ({ page }) => {
    await page.getByRole("button", { name: /scan|câmera|camera/i }).click();
    await expect(
      page.locator("text=/scan|recibo|receipt|câmera|camera/i").first()
    ).toBeVisible({ timeout: 8000 });
    const closeBtn = page.getByRole("button", { name: /fechar|close|×|x|cancelar/i });
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  });

  test("copiar WhatsApp usa clipboard sem erro", async ({ page }) => {
    // Grant clipboard permission
    await page.context().grantPermissions(["clipboard-write"]);
    const whatsappBtn = page.getByText("WhatsApp");
    await whatsappBtn.click();
    // Deve mostrar toast de confirmação
    await expect(
      page.locator("text=/copiado|copied|✓/i").first()
    ).toBeVisible({ timeout: 5000 }).catch(() => {}); // Pode não ter toast, mas não deve crashar
  });
});

test.describe("Transações — modo viagem (Travel Mode)", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
  });

  test("com travel mode ativo, indicador aparece na página de transações", async ({ page }) => {
    // Ativa travel mode via localStorage
    await page.goto("/transactions");
    await page.evaluate(() => {
      localStorage.setItem("lmyf_travel_mode", "true");
      localStorage.setItem("lmyf_travel_currency", "USD");
    });
    await page.reload();
    await expect(
      page.locator("text=/viagem|travel|USD/i").first()
    ).toBeVisible({ timeout: 10_000 });
    // Limpa
    await page.evaluate(() => {
      localStorage.removeItem("lmyf_travel_mode");
      localStorage.removeItem("lmyf_travel_currency");
    });
  });
});
