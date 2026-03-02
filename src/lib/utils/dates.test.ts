import { describe, it, expect } from "vitest";
import {
  MONTHS,
  MONTH_ICONS,
  getMonthKey,
  getStartOfMonth,
  getEndOfMonth,
  formatDateBR,
} from "./dates";

describe("dates", () => {
  describe("MONTHS", () => {
    it("tem 12 meses", () => {
      expect(MONTHS).toHaveLength(12);
    });
    it("começa com Janeiro", () => {
      expect(MONTHS[0]).toBe("Janeiro");
    });
    it("termina com Dezembro", () => {
      expect(MONTHS[11]).toBe("Dezembro");
    });
  });

  describe("MONTH_ICONS", () => {
    it("tem 12 ícones", () => {
      expect(MONTH_ICONS).toHaveLength(12);
    });
  });

  describe("getMonthKey", () => {
    it("retorna YYYY-MM para índice do mês", () => {
      expect(getMonthKey(2024, 0)).toBe("2024-01");
      expect(getMonthKey(2024, 11)).toBe("2024-12");
      expect(getMonthKey(2023, 8)).toBe("2023-09");
    });
  });

  describe("getStartOfMonth", () => {
    it("retorna primeiro dia do mês YYYY-MM-01", () => {
      expect(getStartOfMonth(2024, 0)).toBe("2024-01-01");
      expect(getStartOfMonth(2024, 11)).toBe("2024-12-01");
    });
  });

  describe("getEndOfMonth", () => {
    it("retorna último dia do mês", () => {
      expect(getEndOfMonth(2024, 0)).toBe("2024-01-31");
      expect(getEndOfMonth(2024, 1)).toBe("2024-02-29");
      expect(getEndOfMonth(2023, 1)).toBe("2023-02-28");
      expect(getEndOfMonth(2024, 3)).toBe("2024-04-30");
    });
  });

  describe("formatDateBR", () => {
    it("formata YYYY-MM-DD para DD/MM", () => {
      expect(formatDateBR("2024-03-15")).toBe("15/03");
      expect(formatDateBR("2024-01-01")).toBe("01/01");
    });
    it("retorna -- para string vazia", () => {
      expect(formatDateBR("")).toBe("--");
    });
    it("retorna -- para valor falsy", () => {
      expect(formatDateBR(undefined as unknown as string)).toBe("--");
    });
  });
});
