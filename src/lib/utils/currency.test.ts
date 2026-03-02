import { describe, it, expect } from "vitest";
import { formatBRL, reaisToCents, centsToReais, parseBRL } from "./currency";

describe("currency", () => {
  describe("formatBRL", () => {
    it("formata centavos em reais com símbolo R$", () => {
      expect(formatBRL(100)).toMatch(/R\$\s*1,00/);
      expect(formatBRL(15050)).toMatch(/150,50/);
      expect(formatBRL(0)).toMatch(/0,00/);
    });

    it("usa separador de milhar pt-BR", () => {
      expect(formatBRL(100000)).toMatch(/1\.000,00/);
      expect(formatBRL(1234567)).toMatch(/12\.345,67/);
    });

    it("arredonda corretamente para 2 decimais", () => {
      expect(formatBRL(10099)).toMatch(/100,99/);
      expect(formatBRL(1)).toMatch(/0,01/);
    });
  });

  describe("reaisToCents", () => {
    it("converte reais em centavos", () => {
      expect(reaisToCents(1)).toBe(100);
      expect(reaisToCents(150.5)).toBe(15050);
      expect(reaisToCents(0.01)).toBe(1);
    });

    it("arredonda para inteiro", () => {
      expect(reaisToCents(1.01)).toBe(101);
      expect(reaisToCents(1.004)).toBe(100);
    });
  });

  describe("centsToReais", () => {
    it("converte centavos em reais", () => {
      expect(centsToReais(100)).toBe(1);
      expect(centsToReais(15050)).toBe(150.5);
      expect(centsToReais(1)).toBe(0.01);
    });

    it("retorna 0 para 0 centavos", () => {
      expect(centsToReais(0)).toBe(0);
    });
  });

  describe("parseBRL", () => {
    it("parseia milhares (5.000 = 5000)", () => {
      expect(parseBRL("5.000")).toBe(5000);
      expect(parseBRL("1.000")).toBe(1000);
    });

    it("parseia milhões (1.500.000 = 1500000)", () => {
      expect(parseBRL("1.500.000")).toBe(1500000);
    });

    it("parseia centavos com vírgula (50,99 = 50.99)", () => {
      expect(parseBRL("50,99")).toBe(50.99);
      expect(parseBRL("5,50")).toBe(5.5);
    });

    it("parseia formato BR completo (5.000,50 = 5000.5)", () => {
      expect(parseBRL("5.000,50")).toBe(5000.5);
      expect(parseBRL("1.500,99")).toBe(1500.99);
    });

    it("parseia números simples", () => {
      expect(parseBRL("5000")).toBe(5000);
      expect(parseBRL("50")).toBe(50);
    });

    it("ignora R$ e espaços", () => {
      expect(parseBRL("R$ 5.000")).toBe(5000);
      expect(parseBRL("  1.500,50  ")).toBe(1500.5);
    });

    it("retorna 0 para valores inválidos", () => {
      expect(parseBRL("")).toBe(0);
      expect(parseBRL(null)).toBe(0);
      expect(parseBRL(undefined)).toBe(0);
    });
  });
});
