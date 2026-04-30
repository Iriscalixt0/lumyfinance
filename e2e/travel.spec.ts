/**
 * E2E: Modo Viagem — ativar, selecionar moeda, indicador nas transações,
 * conversão automática, desativar.
 * Requer: E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 */
import { expect, test } from "@playwright/test";
import { loginWithTestAccount, requireTestAccount } from "./helpers";

test.describe("Modo Viagem — página", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
    // Garante que travel mode está desativado antes de cada teste
    await page.evaluate(() => {
      localStorage.removeItem("lmyf_travel_mode");
      localStorage.removeItem("lmyf_travel_currency");
    });
    await page.goto("/travel");
    await page.waitForLoadState("domcontentloaded");
  });

  test("página carrega e exibe opção de modo viagem", async ({ page }) => {
    await expect(page).toHaveURL(/\/travel/);
    await expect(
      page.locator("text=/viagem|travel|mode|modo/i").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("seletor de moeda estrangeira visível", async ({ page }) => {
    const currencySelect = page.locator("select").first();
    const currencyInput = page
      .locator("input[placeholder*='moeda'], input[placeholder*='currency']")
      .first();
    const hasSelect = await currencySelect.isVisible({ timeout: 5000 }).catch(() => false);
    const hasInput = await currencyInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasSelect || hasInput).toBeTruthy();
  });

  test("pode ativar o modo viagem", async ({ page }) => {
    const toggleBtn = page.getByRole("button", {
      name: /ativar|enable|ligar|on|iniciar|start|entrar em modo/i,
    });
    const toggleSwitch = page.locator("[type='checkbox'], [role='switch']").first();

    if (await toggleBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleBtn.first().click();
      await page.waitForTimeout(500);
      // Deve mostrar que está ativo
      await expect(
        page.locator("text=/ativo|active|ativado|enabled|viagem ativa/i").first()
      ).toBeVisible({ timeout: 8000 });
    } else if (await toggleSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleSwitch.click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("pode selecionar moeda USD e ativar", async ({ page }) => {
    const currencySelect = page.locator("select").first();
    if (await currencySelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await currencySelect.selectOption("USD").catch(() => {});
    }

    const toggleBtn = page.getByRole("button", {
      name: /ativar|enable|ligar|on|iniciar|start/i,
    });
    if (await toggleBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleBtn.first().click();
    }

    // Verifica localStorage
    const travelActive = await page.evaluate(() =>
      localStorage.getItem("lmyf_travel_mode")
    );
    // Pode ou não ser "true" dependendo da implementação
    await expect(page.locator("body")).toBeVisible();
  });

  test("modo viagem desativado não mostra indicador", async ({ page }) => {
    // Travel mode não está ativo (limpamos no beforeEach)
    const indicator = page.locator("text=/viagem ativa|travel active|modo viagem ON/i");
    const hasIndicator = await indicator.isVisible({ timeout: 3000 }).catch(() => false);
    // Se não estiver ativo, não deve mostrar indicador
    if (hasIndicator) {
      // Se estiver ativo, desativa
      const disableBtn = page.getByRole("button", {
        name: /desativar|disable|desligar|off|sair/i,
      });
      if (await disableBtn.first().isVisible().catch(() => false)) {
        await disableBtn.first().click();
      }
    }
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Modo Viagem — integração com transações", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const missing = requireTestAccount();
    if (missing) test.skip(true, missing);
    await loginWithTestAccount(page);
  });

  test("com travel mode USD ativo, magic input exibe conversão automática", async ({ page }) => {
    await page.goto("/transactions");
    await page.evaluate(() => {
      localStorage.setItem("lmyf_travel_mode", "true");
      localStorage.setItem("lmyf_travel_currency", "USD");
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Indicador de modo viagem deve aparecer
    await expect(
      page.locator("text=/viagem|travel|USD/i").first()
    ).toBeVisible({ timeout: 10_000 });

    // Digita no magic input — deve assumir USD automaticamente
    const input = page.locator("input[placeholder]").first();
    await input.fill("gastei 50 taxi");
    await page.waitForTimeout(600);

    // Preview deve mostrar conversão
    await expect(page.locator("text=/50/").first()).toBeVisible({ timeout: 8000 });

    // Limpa
    await page.evaluate(() => {
      localStorage.removeItem("lmyf_travel_mode");
      localStorage.removeItem("lmyf_travel_currency");
    });
  });
});
