export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Formata valor em centavos conforme o locale e moeda regional. */
export function formatCurrency(cents: number, locale: string): string {
  const currencyMap: Record<string, string> = {
    "pt-BR": "BRL",
    "pt-PT": "EUR",
    en: "USD",
    es: "EUR",
  };
  const currency = currencyMap[locale] ?? "USD";
  const displayLocale = locale in currencyMap ? locale : "en";
  return new Intl.NumberFormat(displayLocale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

/**
 * Parseia string em formato brasileiro para número (reais).
 * Aceita: 5.000 (mil), 1.500.000 (milhão), 50,99 (centavos), 5.000,50 etc.
 */
export function parseBRL(value: string | null | undefined): number {
  if (value == null || typeof value !== "string") return 0;
  const trimmed = value.trim().replace(/[R$\s]/g, "");
  if (!trimmed) return 0;

  const lastComma = trimmed.lastIndexOf(",");
  const lastPoint = trimmed.lastIndexOf(".");

  if (lastComma > lastPoint) {
    // BR: vírgula decimal (1.500,50)
    const withoutThousands = trimmed.replace(/\./g, "");
    const withDecimal = withoutThousands.replace(",", ".");
    return parseFloat(withDecimal) || 0;
  }
  if (lastPoint > lastComma) {
    // US ou BR só com ponto: 1.500.000 ou 5.000
    const parts = trimmed.split(".");
    if (parts.length >= 2 && parts[parts.length - 1].length <= 2) {
      // Última parte tem 1–2 dígitos = decimal (ex: 5.50)
      const withoutThousands = parts.slice(0, -1).join("");
      const decimal = parts[parts.length - 1];
      return parseFloat(`${withoutThousands}.${decimal}`) || 0;
    }
    // Pontos são milhares (5.000, 1.500.000)
    return parseFloat(trimmed.replace(/\./g, "")) || 0;
  }
  if (trimmed.includes(",") && !trimmed.includes(".")) {
    return parseFloat(trimmed.replace(",", ".")) || 0;
  }
  return parseFloat(trimmed) || 0;
}
