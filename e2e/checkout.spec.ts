/**
 * E2E: full checkout flow — register → login → plan → Stripe Checkout → success.
 * Uses Stripe Test Mode. Card: 4242 4242 4242 4242
 * Requires: E2E_RUN_FULL_CHECKOUT=1
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const STRIPE_TEST_CARD = "4242 4242 4242 4242";
const TEST_EMAIL_DOMAIN = "e2e-checkout-test.placeholder.local";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@${TEST_EMAIL_DOMAIN}`;
}

test.describe("Checkout E2E", () => {
  test.describe.configure({ retries: 2, timeout: 120_000 });

  test.beforeEach(() => {
    test.skip(
      process.env.E2E_RUN_FULL_CHECKOUT !== "1",
      "Set E2E_RUN_FULL_CHECKOUT=1 to run full checkout flow"
    );
  });

  test("full flow: register → login → subscribe → Stripe Checkout → success", async ({ page }) => {
    const email = uniqueEmail();
    const password = "TestPass123!";

    // 1) Register
    await page.goto("/register");
    await page.getByPlaceholder(/nome|full name|nome completo/i).fill("E2E Checkout User");
    await page.getByPlaceholder(/email|e-mail/i).fill(email);
    await page.getByPlaceholder(/senha|password/i).fill(password);
    await page.getByRole("button", { name: /cadastrar|registrar|create|submit/i }).click();

    await page.waitForURL(/\/(register|login|dashboard|onboarding|verify)/, { timeout: 15_000 }).catch(() => {});

    const afterRegUrl = page.url();
    const needsLogin =
      afterRegUrl.includes("/register") ||
      afterRegUrl.includes("/login") ||
      (await page.getByRole("heading", { name: /verifiqu|check your email|confirme/i }).isVisible().catch(() => false));

    if (needsLogin) {
      await page.goto("/login", { waitUntil: "load" });
      await page.getByPlaceholder(/email|e-mail/i).fill(email);
      await page.getByPlaceholder(/senha|password/i).fill(password);
      await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    }

    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 25_000 });

    // Skip onboarding if needed
    if (page.url().includes("/onboarding")) {
      const skipBtn = page.getByRole("button", { name: /pular|skip/i });
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
      }
    }

    // Navigate to plan page
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto("/plan", { waitUntil: "load", timeout: 20_000 });

    const subscribeBtn = page
      .locator("button, a[href*='plan']")
      .filter({ hasText: /pro|assinar|subscribe|dias|trial|days|começar|start|grátis|free/i });
    await expect(subscribeBtn.first()).toBeVisible({ timeout: 20_000 });
    await subscribeBtn.first().click();

    // Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 15_000 });

    const cardDigits = STRIPE_TEST_CARD.replace(/\s/g, "");
    await page.locator("iframe").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.frameLocator("iframe").first().locator("input").first().fill(cardDigits);
    await page.waitForTimeout(300);

    const iframeCount = await page.locator("iframe").count();
    if (iframeCount >= 2) await page.frameLocator("iframe").nth(1).locator("input").first().fill("1234");
    if (iframeCount >= 3) await page.frameLocator("iframe").nth(2).locator("input").first().fill("123");

    await page.getByRole("button", { name: /subscrib|assinar|pay|pagar|confirm/i }).click();
    await page.waitForURL(/\/(dashboard|settings).*checkout=success/, { timeout: 30_000 });

    // Verify access is unlocked
    const lockAlert = page.getByRole("alert").filter({ hasText: /assinar|subscribe|bloqueado/i });
    await expect(lockAlert).not.toBeVisible();

    // Verify in database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 500 });
      const testUser = users?.users?.find((u) => u.email === email);
      if (testUser) {
        const { data: members } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", testUser.id)
          .limit(1);
        const workspaceId = members?.[0]?.workspace_id;
        if (workspaceId) {
          const { data: ws } = await supabase
            .from("workspaces")
            .select("stripe_subscription_id, plan")
            .eq("id", workspaceId)
            .single();
          expect(ws?.stripe_subscription_id).toBeTruthy();
          expect(ws?.plan).toBe("pro");
        }
      }
    }
  });

  test("unauthenticated user accessing /settings redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
