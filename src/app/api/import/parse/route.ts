import { NextResponse } from "next/server";
import Papa from "papaparse";

function detectDelimiter(text: string): string {
  const firstLine = text.split(/[\r\n]+/)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  if (semicolonCount >= commaCount && semicolonCount >= tabCount) return ";";
  if (tabCount >= commaCount && tabCount >= semicolonCount) return "\t";
  return ",";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    try {
      const buf = await file.arrayBuffer();
      const decoder = new TextDecoder("iso-8859-1");
      text = decoder.decode(buf);
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o arquivo" }, { status: 400 });
    }
  }
  const delimiter = detectDelimiter(text);
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    delimiter,
    delimitersToGuess: [",", ";", "\t"],
  });
  if (result.errors.length > 0) {
    return NextResponse.json({
      error: result.errors[0]?.message ?? "Erro ao ler CSV",
      rows: [],
    });
  }
  const rows = result.data ?? [];
  const header = rows[0] ?? [];
  return NextResponse.json({ rows, delimiter, header });
}
