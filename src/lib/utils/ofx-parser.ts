/**
 * Minimal OFX / QFX parser.
 * OFX 1.x is SGML-like, OFX 2.x is XML.
 * We extract <STMTTRN> blocks and return normalised rows.
 */

export interface OFXTransaction {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // cents (positive = income, negative = expense)
  type: "income" | "expense";
  memo: string;
}

function parseOFXDate(raw: string): string {
  // OFX dates: YYYYMMDDHHMMSS or YYYYMMDD
  const y = raw.substring(0, 4);
  const m = raw.substring(4, 6);
  const d = raw.substring(6, 8);
  return `${y}-${m}-${d}`;
}

function extractTag(block: string, tag: string): string {
  // OFX SGML: <TAG>value  (no closing tag in v1)
  // OFX XML:  <TAG>value</TAG>
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  const match = block.match(regex);
  return match ? match[1].trim() : "";
}

export function parseOFX(text: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];

  // Split by <STMTTRN> blocks
  const blocks = text.split(/<STMTTRN>/i).slice(1);

  for (const block of blocks) {
    const endIdx = block.search(/<\/STMTTRN>/i);
    const content = endIdx > -1 ? block.substring(0, endIdx) : block;

    const rawDate = extractTag(content, "DTPOSTED");
    const rawAmount = extractTag(content, "TRNAMT");
    const name = extractTag(content, "NAME");
    const memo = extractTag(content, "MEMO");

    if (!rawDate || !rawAmount) continue;

    const amountFloat = parseFloat(rawAmount.replace(",", "."));
    if (isNaN(amountFloat)) continue;

    const amountCents = Math.round(Math.abs(amountFloat) * 100);

    transactions.push({
      date: parseOFXDate(rawDate),
      description: name || memo || "Sem descrição",
      amount: amountCents,
      type: amountFloat >= 0 ? "income" : "expense",
      memo: memo || "",
    });
  }

  return transactions;
}
