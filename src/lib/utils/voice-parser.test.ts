import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  parseVoiceTransaction,
  predictCategory,
  buildConfirmationPhrase,
  YES_WORDS,
  NO_WORDS,
  CATEGORY_KEYWORDS,
} from "./voice-parser";

// ===================== detectLanguage =====================

describe("detectLanguage", () => {
  it("detects Portuguese", () => {
    expect(detectLanguage("gastei 50 reais no supermercado")).toBe("pt-BR");
  });

  it("detects English", () => {
    expect(detectLanguage("I spent 20 dollars on groceries")).toBe("en-US");
  });

  it("detects Spanish", () => {
    expect(detectLanguage("gasté 30 euros en el supermercado")).toBe("es-ES");
  });

  it("detects French", () => {
    expect(detectLanguage("j'ai dépensé 40 euros pour les courses")).toBe("fr-FR");
  });

  it("detects German", () => {
    expect(detectLanguage("ich habe 25 euro für lebensmittel ausgegeben")).toBe("de-DE");
  });

  it("defaults to en-US for ambiguous text", () => {
    expect(detectLanguage("hello world")).toBe("en-US");
  });
});

// ===================== parseVoiceTransaction =====================

describe("parseVoiceTransaction", () => {
  describe("PT-BR transactions", () => {
    it("parses expense with currency symbol", () => {
      const r = parseVoiceTransaction("gastei R$50 no almoço");
      expect(r.amount).toBe(50);
      expect(r.type).toBe("expense");
      expect(r.currency).toBe("BRL");
      expect(r.detectedLang).toBe("pt-BR");
    });

    it("parses income", () => {
      const r = parseVoiceTransaction("recebi 3000 reais de salário");
      expect(r.amount).toBe(3000);
      expect(r.type).toBe("income");
      expect(r.currency).toBe("BRL");
    });

    it("parses number words", () => {
      const r = parseVoiceTransaction("gastei cinquenta reais no mercado");
      expect(r.amount).toBe(50);
      expect(r.type).toBe("expense");
    });

    it("parses 'mil reais'", () => {
      const r = parseVoiceTransaction("paguei mil reais de aluguel");
      expect(r.amount).toBe(1000);
    });

    it("parses 'ontem'", () => {
      const r = parseVoiceTransaction("gastei 30 reais ontem no mercado");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(r.date).toBe(yesterday.toISOString().split("T")[0]);
    });
  });

  describe("EN-US transactions", () => {
    it("parses dollar expense", () => {
      const r = parseVoiceTransaction("spent $25 on groceries");
      expect(r.amount).toBe(25);
      expect(r.type).toBe("expense");
      expect(r.currency).toBe("USD");
    });

    it("parses income", () => {
      const r = parseVoiceTransaction("received 5000 dollars salary");
      expect(r.amount).toBe(5000);
      expect(r.type).toBe("income");
    });

    it("parses number words in English", () => {
      const r = parseVoiceTransaction("spent twenty five dollars on lunch");
      expect(r.amount).toBe(25);
    });

    it("parses yesterday", () => {
      const r = parseVoiceTransaction("spent 10 dollars yesterday on coffee");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(r.date).toBe(yesterday.toISOString().split("T")[0]);
    });
  });

  describe("ES-ES transactions", () => {
    it("parses Spanish expense", () => {
      const r = parseVoiceTransaction("gasté 45 euros en el supermercado");
      expect(r.amount).toBe(45);
      expect(r.type).toBe("expense");
      expect(r.currency).toBe("EUR");
    });
  });

  describe("FR-FR transactions", () => {
    it("parses French expense", () => {
      const r = parseVoiceTransaction("j'ai dépensé 60 euros pour les courses");
      expect(r.amount).toBe(60);
      expect(r.type).toBe("expense");
      expect(r.currency).toBe("EUR");
    });
  });

  describe("DE-DE transactions", () => {
    it("parses German expense", () => {
      const r = parseVoiceTransaction("bezahlt 35 euro für lebensmittel");
      expect(r.amount).toBe(35);
      expect(r.type).toBe("expense");
      expect(r.currency).toBe("EUR");
    });
  });

  describe("edge cases", () => {
    it("returns null amount when no number found", () => {
      const r = parseVoiceTransaction("gastei no mercado");
      expect(r.amount).toBeNull();
    });

    it("defaults type to expense", () => {
      const r = parseVoiceTransaction("pizza 25");
      expect(r.type).toBe("expense");
    });

    it("defaults date to today", () => {
      const r = parseVoiceTransaction("gastei 10 reais");
      expect(r.date).toBe(new Date().toISOString().split("T")[0]);
    });

    it("handles decimal amounts with comma", () => {
      const r = parseVoiceTransaction("gastei 49,90 reais");
      expect(r.amount).toBe(49.9);
    });

    it("respects hintLang when detection defaults", () => {
      const r = parseVoiceTransaction("pizza 25", "pt-BR");
      expect(r.detectedLang).toBe("pt-BR");
    });
  });
});

// ===================== predictCategory =====================

describe("predictCategory", () => {
  it("detects food category", () => {
    expect(predictCategory("almoço no restaurante")).toBe("Alimentação");
  });

  it("detects transport category", () => {
    expect(predictCategory("uber para o trabalho")).toBe("Transporte & Auto");
  });

  it("detects housing category", () => {
    expect(predictCategory("aluguel do apartamento")).toBe("Casa & Moradia");
  });

  it("detects health category", () => {
    expect(predictCategory("farmácia remédio")).toBe("Saúde & Bem-estar");
  });

  it("detects education category", () => {
    expect(predictCategory("curso de programação")).toBe("Educação");
  });

  it("detects entertainment category", () => {
    expect(predictCategory("netflix mensal")).toBe("Lazer & Entretenimento");
  });

  it("detects investment category", () => {
    expect(predictCategory("bitcoin compra")).toBe("Investimento");
  });

  it("detects salary category", () => {
    expect(predictCategory("salário mensal")).toBe("Salário");
  });

  it("returns null for unknown", () => {
    expect(predictCategory("xyz abc")).toBeNull();
  });

  it("works with English keywords", () => {
    expect(predictCategory("groceries at the store")).toBe("Alimentação");
  });
});

// ===================== buildConfirmationPhrase =====================

describe("buildConfirmationPhrase", () => {
  it("builds PT-BR phrase", () => {
    const r = buildConfirmationPhrase("pt-BR", "R$ 50", "Alimentação");
    expect(r).toContain("R$ 50");
    expect(r).toContain("Alimentação");
    expect(r).toContain("Correto?");
  });

  it("builds EN-US phrase", () => {
    const r = buildConfirmationPhrase("en-US", "$25", "Food");
    expect(r).toContain("$25");
    expect(r).toContain("Correct?");
  });

  it("falls back to en-US for unknown lang", () => {
    const r = buildConfirmationPhrase("xx-XX", "$10", "Test");
    expect(r).toContain("Correct?");
  });
});

// ===================== YES/NO words =====================

describe("YES_WORDS / NO_WORDS", () => {
  it("has multilingual yes words", () => {
    expect(YES_WORDS).toContain("sim");
    expect(YES_WORDS).toContain("yes");
    expect(YES_WORDS).toContain("oui");
    expect(YES_WORDS).toContain("ja");
  });

  it("has multilingual no words", () => {
    expect(NO_WORDS).toContain("não");
    expect(NO_WORDS).toContain("no");
    expect(NO_WORDS).toContain("non");
    expect(NO_WORDS).toContain("nein");
  });
});
