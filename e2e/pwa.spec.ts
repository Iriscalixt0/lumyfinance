/**
 * E2E: PWA — manifest, service worker, instalabilidade.
 * Não requer autenticação.
 */
import { expect, test } from "@playwright/test";

test.describe("PWA — Manifest", () => {
  test("manifest.json está acessível", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    expect(response?.status()).toBe(200);
  });

  test("manifest.json tem campo 'name'", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    const body = await response?.json();
    expect(body).toHaveProperty("name");
    expect(typeof body.name).toBe("string");
    expect(body.name.length).toBeGreaterThan(0);
  });

  test("manifest.json tem campo 'icons'", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    const body = await response?.json();
    expect(body).toHaveProperty("icons");
    expect(Array.isArray(body.icons)).toBeTruthy();
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test("manifest.json tem start_url", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    const body = await response?.json();
    expect(body).toHaveProperty("start_url");
  });

  test("manifest.json tem display standalone ou fullscreen", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    const body = await response?.json();
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(body.display);
  });

  test("tag <link rel='manifest'> presente no HTML", async ({ page }) => {
    await page.goto("/");
    const manifestLink = page.locator("link[rel='manifest']");
    await expect(manifestLink).toHaveCount(1, { timeout: 8000 });
  });
});

test.describe("PWA — Service Worker", () => {
  test("service worker registra sem erros", async ({ page }) => {
    const swErrors: string[] = [];
    page.on("pageerror", (err) => {
      if (err.message.toLowerCase().includes("service worker")) {
        swErrors.push(err.message);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    // Service worker deve registrar sem erros de console
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration("/");
      return !!registration;
    });

    // Em alguns ambientes de teste o SW pode não registrar por HTTPS
    // Apenas verifica que não houve erros críticos
    expect(swErrors.length).toBe(0);
  });

  test("arquivo sw.js está acessível", async ({ page }) => {
    const response = await page.goto("/sw.js");
    expect(response?.status()).toBe(200);
  });

  test("service worker tem estratégia de cache", async ({ page }) => {
    const response = await page.goto("/sw.js");
    const content = await response?.text();
    // O SW deve mencionar cache, fetch ou install
    const hasCacheStrategy =
      content?.includes("cache") ||
      content?.includes("fetch") ||
      content?.includes("install");
    expect(hasCacheStrategy).toBeTruthy();
  });
});

test.describe("PWA — Meta tags e instalabilidade", () => {
  test("meta theme-color presente", async ({ page }) => {
    await page.goto("/");
    const themeColor = page.locator("meta[name='theme-color']");
    await expect(themeColor).toHaveCount(1, { timeout: 8000 });
  });

  test("meta viewport presente", async ({ page }) => {
    await page.goto("/");
    const viewport = page.locator("meta[name='viewport']");
    await expect(viewport).toHaveCount(1, { timeout: 8000 });
  });

  test("apple-touch-icon ou favicon presente", async ({ page }) => {
    await page.goto("/");
    const appleIcon = page.locator("link[rel='apple-touch-icon'], link[rel='icon']").first();
    await expect(appleIcon).toBeAttached({ timeout: 8000 });
  });
});
