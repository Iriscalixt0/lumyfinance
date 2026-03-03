import * as XLSX from "xlsx";

export interface ExcelTransaction {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // cents (positive value)
  type: "income" | "expense";
  memo: string;
}

/**
 * Parse an Excel / CSV file and extract transactions.
 * Supports common column layouts:
 *   - Data, Descrição, Valor, Tipo
 *   - Date, Description, Amount, Type
 * Also auto-detects negative values as expenses.
 */
export function parseExcel(buffer: ArrayBuffer): ExcelTransaction[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) return [];

  // Normalise header keys
  const normalise = (s: string) =>
    s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const keyMap: Record<string, string> = {};
  for (const k of keys) {
    keyMap[normalise(k)] = k;
  }

  // Find column mappings
  const dateKey = keyMap["data"] || keyMap["date"] || keyMap["dt"] || keyMap["dia"] || keys[0];
  const descKey = keyMap["descricao"] || keyMap["description"] || keyMap["desc"] || keyMap["historico"] || keyMap["nome"] || keys[1];
  const amountKey = keyMap["valor"] || keyMap["amount"] || keyMap["value"] || keyMap["quantia"] || keys[2];
  const typeKey = keyMap["tipo"] || keyMap["type"] || keyMap["categoria"] || null;

  const transactions: ExcelTransaction[] = [];

  for (const row of rows) {
    const rawDate = row[dateKey];
    const rawDesc = String(row[descKey] || "").trim();
    const rawAmount = row[amountKey];
    const rawType = typeKey ? String(row[typeKey] || "").toLowerCase() : "";

    // Parse date
    let dateStr: string;
    if (rawDate instanceof Date) {
      dateStr = rawDate.toISOString().split("T")[0];
    } else {
      const s = String(rawDate).trim();
      // Try DD/MM/YYYY
      const brMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
      if (brMatch) {
        dateStr = `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
      } else {
        // Try YYYY-MM-DD
        const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        } else {
          continue; // skip unparseable rows
        }
      }
    }

    // Parse amount
    let amountFloat: number;
    if (typeof rawAmount === "number") {
      amountFloat = rawAmount;
    } else {
      const cleaned = String(rawAmount).replace(/[R$\s]/g, "").replace(".", "").replace(",", ".");
      amountFloat = parseFloat(cleaned);
    }
    if (isNaN(amountFloat)) continue;

    // Determine type
    let type: "income" | "expense";
    if (rawType.includes("receita") || rawType.includes("income") || rawType.includes("entrada") || rawType.includes("credito")) {
      type = "income";
    } else if (rawType.includes("despesa") || rawType.includes("expense") || rawType.includes("saida") || rawType.includes("debito")) {
      type = "expense";
    } else {
      type = amountFloat >= 0 ? "income" : "expense";
    }

    transactions.push({
      date: dateStr,
      description: rawDesc || "Sem descrição",
      amount: Math.round(Math.abs(amountFloat) * 100),
      type,
      memo: "",
    });
  }

  return transactions;
}
