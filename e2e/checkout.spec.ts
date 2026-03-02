/**
 * E2E: fluxo completo de registro → login → plano → Stripe Checkout → sucesso.
 * Usa Stripe Test Mode e ambiente de desenvolvimento.
 * Cartão de teste: 4242 4242 4242 4242
 *
 * Valida: user access, subscription status no banco, trial period.
 */
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_TEST_CARD = "4242 4242 4242 4242";
const TEST_EMAIL_DOMAIN = "e2e-checkout-test.placeholder.local";
const BASE_LOCALE = "pt-BR";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@${TEST_EMAIL_DOMAIN}`;
}

test.describe("Checkout E2E", () => {
  test.describe.configure({ retries: 2, timeout: 120000 });

  test("fluxo completo: registro → login → assinar → Stripe Checkout → sucesso", async ({
    page,
  }) => {
    // Requer: E2E_RUN_FULL_CHECKOUT=1 e Supabase com "Confirm email" desativado (Auth → Email)
    // ou domínio @e2e-checkout-test.placeholder.local na lista de exceções, senão o login fica em /login.
    if (process.env.E2E_RUN_FULL_CHECKOUT !== "1") {
      test.skip(true, "Defina E2E_RUN_FULL_CHECKOUT=1 para rodar o fluxo completo");
    }

    const email = uniqueEmail();
    const password = "TestPass123!";
    const fullName = "E2E Checkout User";

    // 1) Registro
    await page.goto(`/${BASE_LOCALE}/register`);
    await page.getByPlaceholder(/nome|full name|nome completo/i).fill(fullName);
    await page.getByPlaceholder(/email|e-mail/i).fill(email);
    await page.getByPlaceholder(/senha|password/i).fill(password);
    await page.getByRole("button", { name: /cadastrar|registrar|create|submit/i }).click();

    // Aguarda alguma navegação (dashboard, onboarding, login, verify email ou permanece em register)
    await page.waitForURL(/\/(?:en|pt-BR|es|fr|de)\/(register|login|dashboard|onboarding|verify)/, {
      timeout: 15000,
    }).catch(() => {});

    const afterRegisterUrl = page.url();
    const needsLogin = afterRegisterUrl.includes("/register") ||
      afterRegisterUrl.includes("/login") ||
      (await page.getByRole("heading", { name: /verifiqu|check your email|confirme/i }).isVisible().catch(() => false));

    if (needsLogin) {
      await page.goto(`/${BASE_LOCALE}/login`, { waitUntil: "load" });
      await page.getByPlaceholder(/email|e-mail/i).fill(email);
      await page.getByPlaceholder(/senha|password/i).fill(password);
      await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    }

    // Aguarda estar em dashboard ou onboarding (usuário já logado)
    await expect(page).toHaveURL(/\/(?:en|pt-BR|es|fr|de)\/(dashboard|onboarding)(?:\/|$)/, {
      timeout: 25000,
    });

    const currentUrl = page.url();
    const localeMatch = currentUrl.match(/\/(en|pt-BR|es|fr|de)(?:\/|$)/);
    const locale = localeMatch?.[1] ?? BASE_LOCALE;

    // Se está em onboarding, pula para ir ao dashboard (cria workspace)
    if (currentUrl.includes("/onboarding")) {
      const skipBtn = page.getByRole("button", { name: /pular|skip/i });
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      }
    }

    // 3) Navega até a página de plano para assinar (settings tem link, plan tem o botão)
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto(`/${locale}/dashboard/plan`, { waitUntil: "load", timeout: 20000 });
    await page.waitForURL(/\/(dashboard|plan)/, { timeout: 10000 }).catch(() => {});

    // Procura botão ou link de assinar Pro (plan page: botão "Começar X dias grátis"; settings: link "Ver planos e assinar")
    const subscribeBtn = page
      .locator("button, a[href*='plan']")
      .filter({ hasText: /pro|assinar|subscribe|dias|trial|days|redirect|começar|comecar|start|grátis|gratis|free/i });
    await expect(subscribeBtn.first()).toBeVisible({ timeout: 20000 });
    await subscribeBtn.first().click();

    // 4) Deve redirecionar para Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 15000 });

    // 5) Preenche o formulário do Stripe Checkout (campos em iframes)
    const cardDigits = STRIPE_TEST_CARD.replace(/\s/g, "");
    await page.locator("iframe").first().waitFor({ state: "visible", timeout: 15000 });

    await page.frameLocator("iframe").first().locator("input").first().fill(cardDigits);
    await page.waitForTimeout(300);

    const iframeCount = await page.locator("iframe").count();
    if (iframeCount >= 2) {
      await page.frameLocator("iframe").nth(1).locator("input").first().fill("1234");
    }
    if (iframeCount >= 3) {
      await page.frameLocator("iframe").nth(2).locator("input").first().fill("123");
    }

    // Submete o formulário
    const payBtn = page.getByRole("button", {
      name: /subscrib|assinar|pay|pagar|confirm|inscrever/i,
    });
    await payBtn.click();

    // 6) Retorno à aplicação (success)
    await page.waitForURL(/\/(dashboard|onboarding|settings).*checkout=success/, {
      timeout: 30000,
    });

    // 7) Verifica que o acesso está liberado (não mostra bloqueio de assinatura)
    const lockAlert = page.getByRole("alert").filter({ hasText: /assinar|subscribe|bloqueado/i });
    await expect(lockAlert).not.toBeVisible();

    // Aguarda webhook processar e atualizar o banco; refresh para layout pegar stripe_subscription_id
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});

    // 7b) UI: botão "Assinar Pro" na sidebar deve ter sumido (assinatura reconhecida)
    const sidebarAssinarPro = page.locator("aside").getByRole("button", { name: /assinar pro/i });
    await expect(sidebarAssinarPro).not.toBeVisible();
    const sidebarLinkAssinarPro = page.locator("aside").getByRole("link", { name: /assinar pro/i });
    await expect(sidebarLinkAssinarPro).not.toBeVisible();

    // 7c) Página de plano: deve mostrar "Gerenciar" (não "Assinar")
    await page.goto(`/${locale}/dashboard/plan`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByRole("button", { name: /gerenciar|manage/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button").filter({ hasText: /assinar pro|começar.*grátis|comecar.*gratis/i })).not.toBeVisible();

    // 7d) Banner "Para acessar o app, assine o plano Pro" não deve aparecer
    await page.goto(`/${locale}/dashboard/transactions`, { waitUntil: "load", timeout: 15000 });
    const bannerAssinar = page.getByText(/para acessar o app, assine o plano pro/i);
    await expect(bannerAssinar).not.toBeVisible();

    // 7e) Configurações: seção "Plano e cobrança" com opção de gerenciar
    await page.goto(`/${locale}/dashboard/settings`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByText(/plano e cobrança|plan and billing/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /gerenciar plano|manage plan/i })).toBeVisible({ timeout: 5000 });

    // 8) Valida subscription status no banco (se variáveis disponíveis)
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
          .not("accepted_at", "is", null)
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

    // 9) Valida trial no Stripe (se configurado)
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (supabaseUrl && supabaseServiceKey && stripeSecret?.startsWith("sk_test_")) {
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
            .select("stripe_subscription_id")
            .eq("id", workspaceId)
            .single();
          if (ws?.stripe_subscription_id) {
            const stripe = new Stripe(stripeSecret, { apiVersion: "2026-01-28.clover" });
            const sub = await stripe.subscriptions.retrieve(ws.stripe_subscription_id);
            expect(sub.status).toMatch(/trialing|active/);
            expect(sub.trial_end).toBeTruthy();
            const trialDays = sub.trial_end
              ? Math.round((sub.trial_end - (sub.trial_start ?? sub.trial_end)) / (24 * 60 * 60))
              : 0;
            expect(trialDays).toBe(7);
          }
        }
      }
    }
  });

  test("fluxo completo em mobile: após assinar, botões Assinar Pro e banner somem", async ({
    page,
  }) => {
    if (process.env.E2E_RUN_FULL_CHECKOUT !== "1") {
      test.skip(true, "Defina E2E_RUN_FULL_CHECKOUT=1 para rodar o fluxo completo");
    }

    await page.setViewportSize({ width: 390, height: 844 });

    const email = uniqueEmail();
    const password = "TestPass123!";
    const fullName = "E2E Mobile User";

    await page.goto(`/${BASE_LOCALE}/register`);
    await page.getByPlaceholder(/nome|full name|nome completo/i).fill(fullName);
    await page.getByPlaceholder(/email|e-mail/i).fill(email);
    await page.getByPlaceholder(/senha|password/i).fill(password);
    await page.getByRole("button", { name: /cadastrar|registrar|create|submit/i }).click();

    await page.waitForURL(/\/(?:en|pt-BR|es|fr|de)\/(register|login|dashboard|onboarding|verify)/, {
      timeout: 15000,
    }).catch(() => {});

    const afterRegUrl = page.url();
    const needsLoginMobile = afterRegUrl.includes("/register") ||
      afterRegUrl.includes("/login") ||
      (await page.getByRole("heading", { name: /verifiqu|check your email|confirme/i }).isVisible().catch(() => false));

    if (needsLoginMobile) {
      await page.goto(`/${BASE_LOCALE}/login`, { waitUntil: "load" });
      await page.getByPlaceholder(/email|e-mail/i).fill(email);
      await page.getByPlaceholder(/senha|password/i).fill(password);
      await page.getByRole("button", { name: /entrar|login|sign in/i }).click();
    }

    await expect(page).toHaveURL(/\/(?:en|pt-BR|es|fr|de)\/(dashboard|onboarding)(?:\/|$)/, {
      timeout: 25000,
    });

    const currentUrl = page.url();
    const localeMatch = currentUrl.match(/\/(en|pt-BR|es|fr|de)(?:\/|$)/);
    const locale = localeMatch?.[1] ?? BASE_LOCALE;

    if (currentUrl.includes("/onboarding")) {
      const skipBtn = page.getByRole("button", { name: /pular|skip/i });
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      }
    }

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto(`/${locale}/dashboard/plan`, { waitUntil: "load", timeout: 20000 });

    const subscribeBtn = page
      .locator("button, a[href*='plan']")
      .filter({ hasText: /pro|assinar|subscribe|dias|trial|days|redirect|começar|comecar|start|grátis|gratis|free/i });
    await expect(subscribeBtn.first()).toBeVisible({ timeout: 20000 });
    await subscribeBtn.first().click();

    await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 15000 });

    const cardDigits = STRIPE_TEST_CARD.replace(/\s/g, "");
    await page.locator("iframe").first().waitFor({ state: "visible", timeout: 15000 });
    await page.frameLocator("iframe").first().locator("input").first().fill(cardDigits);
    await page.waitForTimeout(300);
    const iframeCount = await page.locator("iframe").count();
    if (iframeCount >= 2) {
      await page.frameLocator("iframe").nth(1).locator("input").first().fill("1234");
    }
    if (iframeCount >= 3) {
      await page.frameLocator("iframe").nth(2).locator("input").first().fill("123");
    }

    const payBtn = page.getByRole("button", {
      name: /subscrib|assinar|pay|pagar|confirm|inscrever/i,
    });
    await payBtn.click();

    await page.waitForURL(/\/(dashboard|onboarding|settings).*checkout=success/, {
      timeout: 30000,
    });

    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});

    // Mobile: menu pode estar fechado; abrir para checar sidebar
    const menuBtn = page.getByRole("button", { name: /menu|abrir|open/i });
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(500);
    }

    const sidebarAssinarPro = page.locator("aside").getByRole("button", { name: /assinar pro/i });
    await expect(sidebarAssinarPro).not.toBeVisible();
    const sidebarLinkAssinarPro = page.locator("aside").getByRole("link", { name: /assinar pro/i });
    await expect(sidebarLinkAssinarPro).not.toBeVisible();

    await page.goto(`/${locale}/dashboard/plan`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByRole("button", { name: /gerenciar|manage/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button").filter({ hasText: /assinar pro|começar.*grátis|comecar.*gratis/i })).not.toBeVisible();

    await page.goto(`/${locale}/dashboard/transactions`, { waitUntil: "load", timeout: 15000 });
    const bannerAssinar = page.getByText(/para acessar o app, assine o plano pro/i);
    await expect(bannerAssinar).not.toBeVisible();
  });

  test("deve redirecionar para login quando não autenticado ao acessar settings", async ({
    page,
  }) => {
    await page.goto(`/${BASE_LOCALE}/dashboard/settings`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
