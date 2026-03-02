import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { getCountryFromRequest, getCountryFromHeaders, isBrazil } from "./country";

function createMockRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("country", () => {
  describe("getCountryFromRequest", () => {
    it("retorna país do header CF-IPCountry quando presente", async () => {
      const request = createMockRequest({ "CF-IPCountry": "US" });
      const country = await getCountryFromRequest(request);
      expect(country).toBe("US");
    });

    it("retorna país do header X-Vercel-IP-Country quando presente", async () => {
      const request = createMockRequest({ "X-Vercel-IP-Country": "BR" });
      const country = await getCountryFromRequest(request);
      expect(country).toBe("BR");
    });

    it("prioriza X-Vercel-IP-Country sobre CF-IPCountry", async () => {
      const request = createMockRequest({
        "X-Vercel-IP-Country": "BR",
        "CF-IPCountry": "US",
      });
      const country = await getCountryFromRequest(request);
      expect(country).toBe("BR");
    });

    it("retorna null quando não há headers de geo e não há IP", async () => {
      const request = createMockRequest({});
      const country = await getCountryFromRequest(request);
      expect(country).toBeNull();
    });
  });

  describe("getCountryFromHeaders", () => {
    it("retorna país do header cf-ipcountry quando presente", async () => {
      const headers = new Headers({ "cf-ipcountry": "US" });
      const country = await getCountryFromHeaders(headers);
      expect(country).toBe("US");
    });
  });

  describe("isBrazil", () => {
    it("retorna true para BR", () => {
      expect(isBrazil("BR")).toBe(true);
      expect(isBrazil("br")).toBe(true);
    });
    it("retorna false para outros países", () => {
      expect(isBrazil("US")).toBe(false);
      expect(isBrazil("PT")).toBe(false);
    });
    it("retorna false para null", () => {
      expect(isBrazil(null)).toBe(false);
    });
  });
});
