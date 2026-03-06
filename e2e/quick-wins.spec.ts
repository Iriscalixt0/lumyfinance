import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.quickwins.local`;
}

async function createE2EUser(email: string, password: string, options?: { completeOnboarding?: boolean }) {
  if (!SUPABASE_URL || !serviceRoleKey) throw new Error("Missing env vars");
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
      { id: data.user.id, full_name: "E2E Quick Wins", onboarding_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
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

async function login(page: any, email: string, password: string) {
  await page.goto("/login");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByPlaceholder(/email|e-mail/i).fill(email);
    await page.getByPlaceholder(/senha|password/i).fill(password);
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    try {
      await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 12_000 });
      return;
    } catch {
      await page.waitForTimeout(1500);
    }
  }
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
}

test.describe("Quick wins: trial e onboarding", () => {
  test.describe.configure({ timeout: 120_000, retries: 1, mode: "serial" });

  test("onboarding familia mostra convite imediato", async ({ page }) => {
    test.skip(
      process.env.E2E_RUN_ONBOARDING_INVITE !== "1",
      "Set E2E_RUN_ONBOARDING_INVITE=1 to run"
    );

    const email = uniqueEmail("onboarding-family");
    const password = "E2EQuickWins#123";
    let userId = "";

    try {
      userId = await createE2EUser(email, password);
      await login(page, email, password);

      if (!page.url().includes("/onboarding")) {
        await page.goto("/onboarding");
      }

      await expect(page.getByRole("heading", { name: /para quem|who will you use/i })).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: /fam[ií]lia|family/i }).first().click();

      await expect(page.getByRole("heading", { name: /como quer chamar|what do you want to call/i })).toBeVisible({ timeout: 15_000 });
    } finally {
      if (userId) await deleteE2EUser(userId);
    }
  });
});
