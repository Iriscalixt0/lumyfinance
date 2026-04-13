import { describe, it, expect } from "vitest";
import { buildVoiceResponse } from "./voice-response";

const mockFmt = { money: (v: number) => `R$ ${(v / 100).toFixed(2)}` };

describe("buildVoiceResponse", () => {
  it("returns simple confirmation with no budget and no total", () => {
    const r = buildVoiceResponse({
      lang: "pt-BR",
      amount: 50,
      category: null,
      monthlyTotal: 0,
      budgetLimit: null,
      fmt: mockFmt,
    });
    expect(r).toBe("Anotado!");
  });

  it("returns under budget message", () => {
    const r = buildVoiceResponse({
      lang: "pt-BR",
      amount: 50,
      category: "Alimentação",
      monthlyTotal: 300,
      budgetLimit: 500,
      fmt: mockFmt,
    });
    expect(r).toContain("Anotado!");
    expect(r).toContain("disponível");
  });

  it("returns over budget message", () => {
    const r = buildVoiceResponse({
      lang: "pt-BR",
      amount: 100,
      category: "Alimentação",
      monthlyTotal: 600,
      budgetLimit: 500,
      fmt: mockFmt,
    });
    expect(r).toContain("acima do limite");
  });

  it("returns exact budget message", () => {
    const r = buildVoiceResponse({
      lang: "pt-BR",
      amount: 100,
      category: "Alimentação",
      monthlyTotal: 500,
      budgetLimit: 500,
      fmt: mockFmt,
    });
    expect(r).toContain("exatamente");
  });

  it("returns no-budget context when category exists", () => {
    const r = buildVoiceResponse({
      lang: "pt-BR",
      amount: 50,
      category: "Transporte",
      monthlyTotal: 200,
      budgetLimit: null,
      fmt: mockFmt,
    });
    expect(r).toContain("Total");
    expect(r).toContain("Transporte");
  });

  it("works in English", () => {
    const r = buildVoiceResponse({
      lang: "en-US",
      amount: 25,
      category: "Food",
      monthlyTotal: 400,
      budgetLimit: 500,
      fmt: mockFmt,
    });
    expect(r).toContain("Got it!");
    expect(r).toContain("left");
  });

  it("works in Spanish", () => {
    const r = buildVoiceResponse({
      lang: "es",
      amount: 30,
      category: "Comida",
      monthlyTotal: 200,
      budgetLimit: null,
      fmt: mockFmt,
    });
    expect(r).toContain("¡Anotado!");
  });

  it("works in French", () => {
    const r = buildVoiceResponse({
      lang: "fr",
      amount: 40,
      category: "Nourriture",
      monthlyTotal: 300,
      budgetLimit: 400,
      fmt: mockFmt,
    });
    expect(r).toContain("Noté!");
  });

  it("works in German", () => {
    const r = buildVoiceResponse({
      lang: "de",
      amount: 35,
      category: "Essen",
      monthlyTotal: 250,
      budgetLimit: 300,
      fmt: mockFmt,
    });
    expect(r).toContain("Notiert!");
  });

  it("falls back to en-US for unknown lang", () => {
    const r = buildVoiceResponse({
      lang: "xx-XX",
      amount: 10,
      category: null,
      monthlyTotal: 0,
      budgetLimit: null,
      fmt: mockFmt,
    });
    expect(r).toBe("Got it!");
  });
});
