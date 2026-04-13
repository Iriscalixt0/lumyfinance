import { describe, it, expect } from "vitest";
import {
  parseVoiceGoal,
  parseVoiceBudget,
  parseVoiceBilling,
} from "./voice-form-parser";

// ===================== parseVoiceGoal =====================

describe("parseVoiceGoal", () => {
  it("parses PT goal with amount and deadline", () => {
    const r = parseVoiceGoal("criar meta de viagem 5000 reais amanhã");
    expect(r.targetAmount).toBe(5000);
    expect(r.deadline).not.toBeNull();
    expect(r.title.length).toBeGreaterThan(0);
  });

  it("parses EN goal", () => {
    const r = parseVoiceGoal("create goal buy a car $30000 next week");
    expect(r.targetAmount).toBe(30000);
    expect(r.deadline).not.toBeNull();
  });

  it("handles goal without amount", () => {
    const r = parseVoiceGoal("meta de emergência");
    expect(r.targetAmount).toBeNull();
    expect(r.title.length).toBeGreaterThan(0);
  });

  it("handles goal without deadline", () => {
    const r = parseVoiceGoal("meta 10000 reais casa nova");
    expect(r.targetAmount).toBe(10000);
    expect(r.title.length).toBeGreaterThan(0);
  });

  it("parses 'mil' amount", () => {
    const r = parseVoiceGoal("meta de mil reais");
    expect(r.targetAmount).toBe(1000);
  });

  it("parses ES goal", () => {
    const r = parseVoiceGoal("crear objetivo vacaciones 3000 euros mañana");
    expect(r.targetAmount).toBe(3000);
    expect(r.deadline).not.toBeNull();
  });

  it("parses FR goal", () => {
    const r = parseVoiceGoal("créer objectif voyage 2000 euros demain");
    expect(r.targetAmount).toBe(2000);
    expect(r.deadline).not.toBeNull();
  });

  it("parses DE goal", () => {
    const r = parseVoiceGoal("erstellen ziel auto 5000 euro morgen");
    expect(r.targetAmount).toBe(5000);
    expect(r.deadline).not.toBeNull();
  });
});

// ===================== parseVoiceBudget =====================

describe("parseVoiceBudget", () => {
  it("parses PT budget", () => {
    const r = parseVoiceBudget("orçamento alimentação 800 reais");
    expect(r.limitAmount).toBe(800);
    expect(r.category.length).toBeGreaterThan(0);
  });

  it("parses EN budget", () => {
    const r = parseVoiceBudget("budget groceries $500");
    expect(r.limitAmount).toBe(500);
  });

  it("handles budget without amount", () => {
    const r = parseVoiceBudget("orçamento transporte");
    expect(r.limitAmount).toBeNull();
    expect(r.category.length).toBeGreaterThan(0);
  });

  it("parses currency with comma decimal", () => {
    const r = parseVoiceBudget("orçamento lazer 350,50 reais");
    expect(r.limitAmount).toBe(350.5);
  });
});

// ===================== parseVoiceBilling =====================

describe("parseVoiceBilling", () => {
  it("parses PT billing with due date", () => {
    const r = parseVoiceBilling("cobrança luz 250 reais amanhã");
    expect(r.amount).toBe(250);
    expect(r.dueDate).not.toBeNull();
    expect(r.description.length).toBeGreaterThan(0);
  });

  it("parses EN billing", () => {
    const r = parseVoiceBilling("billing electricity $150 tomorrow");
    expect(r.amount).toBe(150);
    expect(r.dueDate).not.toBeNull();
  });

  it("handles billing without amount", () => {
    const r = parseVoiceBilling("cobrança internet");
    expect(r.amount).toBeNull();
    expect(r.description.length).toBeGreaterThan(0);
  });

  it("parses date pattern DD/MM", () => {
    const r = parseVoiceBilling("conta de luz 200 reais 15/06");
    expect(r.amount).toBe(200);
    expect(r.dueDate).not.toBeNull();
    if (r.dueDate) {
      expect(r.dueDate).toMatch(/^\d{4}-06-15$/);
    }
  });

  it("parses next week", () => {
    const r = parseVoiceBilling("cobrança aluguel 1500 semana que vem");
    expect(r.amount).toBe(1500);
    expect(r.dueDate).not.toBeNull();
    if (r.dueDate) {
      const due = new Date(r.dueDate);
      const now = new Date();
      const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(5);
      expect(diffDays).toBeLessThanOrEqual(8);
    }
  });
});
