/**
 * Shared E2E test helpers — auth, user creation, navigation.
 *
 * Env vars required for authenticated tests:
 *   E2E_TEST_EMAIL    — email of a pre-existing test account
 *   E2E_TEST_PASSWORD — password of that account
 *
 * Env vars required for user-creation tests:
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (admin)
 */

import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const E2E_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
export const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zoajcpbuldrolqtkwppf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.lumyfinance.local`;
}

export function requireTestAccount() {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    return "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated tests.";
  }
  return null;
}

export async function createAdminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE env vars");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createE2EUser(
  email: string,
  password: string,
  fullName = "E2E Test User"
): Promise<string> {
  const admin = await createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create user");
  // Mark onboarding as completed so tests go straight to dashboard
  await admin
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        full_name: fullName,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  return data.user.id;
}

export async function deleteE2EUser(userId: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const admin = await createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByPlaceholder(/email|e-mail/i).fill(email);
    await page.getByPlaceholder(/senha|password/i).fill(password);
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    try {
      await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
      break;
    } catch {
      await page.waitForTimeout(1500);
    }
  }
  // Skip onboarding if landed there
  if (page.url().includes("/onboarding")) {
    const skipBtn = page.getByRole("button", { name: /pular|skip/i });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
    } else {
      const personal = page.getByRole("button", { name: /pessoal|personal/i }).first();
      if (await personal.isVisible().catch(() => false)) {
        await personal.click();
        const continueBtn = page.getByRole("button", { name: /continuar|continue/i });
        await continueBtn.click();
      }
    }
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  }
}

export async function loginWithTestAccount(page: Page): Promise<void> {
  await login(page, E2E_EMAIL, E2E_PASSWORD);
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
}
