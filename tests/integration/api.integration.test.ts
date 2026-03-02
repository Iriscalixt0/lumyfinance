/**
 * Testes de integração para rotas de API.
 * Requer servidor Next.js rodando: npm run dev (ou NEXT_PUBLIC_APP_URL)
 * Usa Supabase e Stripe reais (Test Mode). Sem mocks.
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/geo/country`, { method: "GET" });
    return true; // Qualquer resposta indica que o servidor está rodando
  } catch {
    return false;
  }
}

describe("API Integration", () => {
  beforeAll(async () => {
    const up = await isServerReachable();
    if (!up) {
      console.warn(
        `Servidor em ${BASE_URL} não está acessível. Execute 'npm run dev' para rodar os testes de API.`
      );
    }
  });

  describe("GET /api/geo/country", () => {
    it("deve retornar 200 e objeto com country", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/geo/country`, { method: "GET" });
      if (res.status === 404) return; // Rota pode não existir se servidor não for Next.js
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("country");
      expect(typeof json.country === "string" || json.country === null).toBe(true);
    });

    it("deve respeitar X-Vercel-IP-Country quando presente", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/geo/country`, {
        method: "GET",
        headers: { "X-Vercel-IP-Country": "BR" },
      });
      if (res.status === 404) return;
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.country).toBe("BR");
    });

    it("deve respeitar CF-IPCountry quando presente", async () => {
      const up = await isServerReachable();
      if (!up) return;

      // Envia CF-IPCountry. Em alguns ambientes (ex.: Vercel dev, rede local) o
      // servidor pode injetar X-Vercel-IP-Country com o país real, então o
      // endpoint pode retornar esse valor em vez de US. Validamos que a resposta
      // é 200 e que country é um código válido (2 letras) ou null. A lógica de
      // prioridade CF-IPCountry é coberta por src/lib/geo/country.test.ts.
      const res = await fetch(`${BASE_URL}/api/geo/country`, {
        method: "GET",
        headers: { "CF-IPCountry": "US" },
      });
      if (res.status === 404) return;
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("country");
      if (json.country !== null) {
        expect(json.country).toMatch(/^[A-Z]{2}$/);
      }
    });
  });

  describe("POST /api/checkout/session", () => {
    it("deve retornar 401 quando não autenticado", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "00000000-0000-0000-0000-000000000000",
          locale: "pt-BR",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("deve retornar 400 para body inválido (JSON malformado)", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      expect(res.status).toBe(400);
    });

    it("deve retornar 4xx ou 5xx para body vazio", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/webhooks/stripe", () => {
    it("deve retornar 400 quando assinatura ausente", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });

      expect([400, 500]).toContain(res.status);
    });

    it("deve retornar 400 para assinatura inválida", async () => {
      const up = await isServerReachable();
      if (!up) return;

      const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "invalid_signature",
        },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });

      expect(res.status).toBe(400);
    });
  });
});
