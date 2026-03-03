import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, Check, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { parseOFX, type OFXTransaction } from "@/lib/utils/ofx-parser";
import { parseExcel, type ExcelTransaction } from "@/lib/utils/excel-parser";
import { supabase } from "@/lib/supabase";
import { useIntlFormat } from "@/hooks/useIntlFormat";

type ParsedTx = (OFXTransaction | ExcelTransaction) & { selected: boolean };

interface ImportTransactionsModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  onImported: () => void;
}

export function ImportTransactionsModal({
  open,
  onClose,
  workspaceId,
  userId,
  onImported,
}: ImportTransactionsModalProps) {
  const fmt = useIntlFormat();
  const formatBRL = fmt.money;
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTx[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setParsed([]);
    setFileName("");
    setError("");
    setImporting(false);
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setDone(false);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "ofx" || ext === "qfx") {
        const text = await file.text();
        const txs = parseOFX(text);
        if (txs.length === 0) {
          setError("Nenhuma transação encontrada no arquivo OFX.");
          return;
        }
        setParsed(txs.map((t) => ({ ...t, selected: true })));
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        const buffer = await file.arrayBuffer();
        const txs = parseExcel(buffer);
        if (txs.length === 0) {
          setError("Nenhuma transação encontrada. Verifique se as colunas contêm: Data, Descrição, Valor.");
          return;
        }
        setParsed(txs.map((t) => ({ ...t, selected: true })));
      } else {
        setError("Formato não suportado. Use .ofx, .qfx, .xlsx, .xls ou .csv");
      }
    } catch {
      setError("Erro ao processar o arquivo. Verifique o formato.");
    }

    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleAll(checked: boolean) {
    setParsed((prev) => prev.map((t) => ({ ...t, selected: checked })));
  }

  function toggleOne(index: number) {
    setParsed((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  }

  async function handleImport() {
    const selected = parsed.filter((t) => t.selected);
    if (selected.length === 0) return;

    setImporting(true);
    setError("");

    const rows = selected.map((t) => ({
      workspace_id: workspaceId,
      created_by: userId,
      description: t.description.substring(0, 200),
      amount: t.amount,
      type: t.type,
      date: t.date,
      notes: t.memo || null,
      category_id: null,
    }));

    // Batch insert in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error: insertError } = await supabase.from("transactions").insert(chunk);
      if (insertError) {
        setError(`Erro ao importar: ${insertError.message}`);
        setImporting(false);
        return;
      }
    }

    setImporting(false);
    setDone(true);
    onImported();
  }

  const selectedCount = parsed.filter((t) => t.selected).length;

  return (
    <Modal open={open} onClose={handleClose} title="Importar transações">
      <div className="space-y-4">
        {!done && parsed.length === 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              Importe suas transações a partir de arquivos OFX (extratos bancários) ou planilhas Excel/CSV.
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Clique para selecionar um arquivo
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos: .ofx, .qfx, .xlsx, .xls, .csv
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".ofx,.qfx,.xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
            />
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!done && parsed.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
                <span className="text-xs text-muted-foreground">
                  ({parsed.length} transações)
                </span>
              </div>
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Trocar arquivo
              </button>
            </div>

            {/* Select all */}
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={selectedCount === parsed.length}
                onChange={(e) => toggleAll(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">
                {selectedCount} de {parsed.length} selecionadas
              </span>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-y-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsed.map((tx, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-muted/30 transition-colors ${
                        !tx.selected ? "opacity-40" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={tx.selected}
                          onChange={() => toggleOne(i)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {fmt.date(new Date(tx.date + "T12:00:00"))}
                      </td>
                      <td className="px-3 py-2 text-foreground truncate max-w-[200px]">
                        {tx.description}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold whitespace-nowrap ${
                          tx.type === "income" ? "text-emerald-500" : "text-destructive"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatBRL(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Importar {selectedCount} transações
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {done && (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Importação concluída!
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {selectedCount} transações foram importadas com sucesso.
            </p>
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity text-sm"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
