import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE_LOCALE = "pt-BR";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.quickwins.local`;
}

async function createE2EUser(
  email: string,
  password: string,
  options?: { completeOnboarding?: boolean }
) {
  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E Quick Wins" },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create user");

  if (options?.completeOnboarding) {
    await admin.from("profiles").upsert(
      {
        id: data.user.id,
        full_name: "E2E Quick Wins",
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }
  return data.user.id;
}

async function deleteE2EUser(userId: string) {
  if (!SUPABASE_URL || !serviceRoleKey) return;
  const admin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.auth.admin.deleteUser(userId);
}

async function login(page: Parameters<typeof test>[0]["page"], email: string, password: string) {
  await page.goto(`/${BASE_LOCALE}/login`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByPlaceholder(/email|e-mail/i).fill(email);
    await page.getByPlaceholder(/senha|password/i).fill(password);
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    try {
      await expect(page).toHaveURL(/\/(?:en|pt-BR|es|fr|de)\/(dashboard|onboarding)(?:\/|$)/, {
        timeout: 12_000,
      });
      return;
    } catch {
      await page.waitForTimeout(1500);
    }
  }
  await expect(page).toHaveURL(/\/(?:en|pt-BR|es|fr|de)\/(dashboard|onboarding)(?:\/|$)/, {
    timeout: 20_000,
  });
}

async function addTransaction(page: Parameters<typeof test>[0]["page"], description: string, amount: string) {
  await page.getByPlaceholder(/ex:\s*supermercado/i).fill(description);
  await page.getByPlaceholder(/0,00|0.00/).fill(amount);
  await page.getByRole("button", { name: /salvar|save/i }).click();
}

test.describe("Quick wins: trial e onboarding familia", () => {
  test.describe.configure({ timeout: 120_000, retries: 1, mode: "serial" });

  test("onboarding familia mostra convite imediato", async ({ page }) => {
    test.skip(
      process.env.E2E_RUN_ONBOARDING_INVITE !== "1",
      "Defina E2E_RUN_ONBOARDING_INVITE=1 para validar o convite no onboarding."
    );

    const email = uniqueEmail("onboarding-family");
    const password = "E2EQuickWins#123";
    let userId = "";

    try {
      userId = await createE2EUser(email, password);
      await login(page, email, password);

      if (!page.url().includes("/onboarding")) {
        await page.goto(`/${BASE_LOCALE}/onboarding`);
      }

      await expect(page.getByRole("heading", { name: /para quem voc[eê] vai usar|who will you use/i })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole("button", { name: /fam[ií]lia|family/i }).first().click();

      await expect(page.getByRole("heading", { name: /como quer chamar seu espa[cç]o|what do you want to call/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/Convidar parceiro\(a\) agora|Invite partner now/i)).toBeVisible();

      await page.getByPlaceholder(/Nome do parceiro|Partner name/i).fill("Parceiro E2E");
      await page.getByRole("button", { name: /Gerar convite|Generate invite/i }).click();
      await expect(page.getByText(/Link de convite pronto|Invite link ready/i)).toBeVisible({ timeout: 15_000 });
    } finally {
      if (userId) await deleteE2EUser(userId);
    }
  });

  test("permite 3 transacoes e bloqueia na quarta sem plano", async ({ page }) => {
    const email = uniqueEmail("trial-3tx");
    const password = "E2EQuickWins#123";
    let userId = "";

    try {
      userId = await createE2EUser(email, password, { completeOnboarding: true });
      await login(page, email, password);

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

      await page.goto(`/${BASE_LOCALE}/dashboard/transactions`);
      await expect(page.getByText(/nova transa[cç][aã]o|new transaction/i)).toBeVisible({ timeout: 15_000 });

      await addTransaction(page, "E2E tx 1", "10,00");
      await expect(page.getByText(/Salvo|Saved/i)).toBeVisible({ timeout: 10_000 });

      await addTransaction(page, "E2E tx 2", "20,00");
      await expect(page.getByText(/Salvo|Saved/i)).toBeVisible({ timeout: 10_000 });

      await addTransaction(page, "E2E tx 3", "30,00");
      await expect(page.getByText(/Salvo|Saved/i)).toBeVisible({ timeout: 10_000 });

      await addTransaction(page, "E2E tx 4", "40,00");
      await expect(page.getByText(/j[aá] criou 3 transa[cç][oõ]es|already created 3 transactions/i)).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      if (userId) await deleteE2EUser(userId);
    }
  });
});
