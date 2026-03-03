import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { Receipt, Trash2, ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface ScannedReceipt {
  id: string;
  image_path: string;
  description: string | null;
  amount: number | null;
  date: string | null;
  type: string | null;
  category: string | null;
  confidence: number | null;
  created_at: string;
}

interface ReceiptHistoryProps {
  workspaceId: string;
}

export function ReceiptHistory({ workspaceId }: ReceiptHistoryProps) {
  const fmt = useIntlFormat();
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<ScannedReceipt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, [workspaceId]);

  async function loadReceipts() {
    setLoading(true);
    const { data } = await supabase
      .from("scanned_receipts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    setReceipts(data ?? []);
    setLoading(false);
  }

  function getPublicUrl(path: string) {
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return data?.publicUrl ?? "";
  }

  function openPreview(receipt: ScannedReceipt) {
    setPreviewReceipt(receipt);
    setPreviewUrl(getPublicUrl(receipt.image_path));
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const receipt = receipts.find((r) => r.id === deleteId);
    if (receipt) {
      await supabase.storage.from("receipts").remove([receipt.image_path]);
    }
    await supabase.from("scanned_receipts").delete().eq("id", deleteId);
    setReceipts((prev) => prev.filter((r) => r.id !== deleteId));
    setDeleteId(null);
    setDeleting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold text-foreground mb-1">Nenhum recibo escaneado</p>
        <p className="text-xs text-muted-foreground">
          Use o botão "Escanear recibo" para digitalizar suas notas fiscais.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-border">
        {receipts.map((r) => (
          <div
            key={r.id}
            className="px-5 py-3 flex items-center gap-4 group hover:bg-muted/30 transition-colors"
          >
            {/* Thumbnail */}
            <button
              onClick={() => openPreview(r)}
              className="flex-shrink-0 h-12 w-12 rounded-lg border border-border overflow-hidden bg-muted/30 hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <img
                src={getPublicUrl(r.image_path)}
                alt="Recibo"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {r.description || "Recibo escaneado"}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {r.amount != null && (
                  <span className="font-semibold text-foreground">
                    {fmt.money(r.amount)}
                  </span>
                )}
                {r.date && <span>{r.date}</span>}
                {r.category && <span>{r.category}</span>}
                {r.confidence != null && (
                  <span className="text-muted-foreground">
                    {r.confidence}% confiança
                  </span>
                )}
              </div>
            </div>

            {/* Date */}
            <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
              {fmt.dateTime(r.created_at)}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openPreview(r)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Ver recibo"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDeleteId(r.id)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Excluir recibo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Image preview modal */}
      <Modal
        open={!!previewUrl}
        onClose={() => { setPreviewUrl(null); setPreviewReceipt(null); }}
        title={previewReceipt?.description || "Recibo"}
      >
        <div className="space-y-4">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Recibo"
              className="w-full max-h-[60vh] object-contain rounded-xl border border-border bg-muted/30"
            />
          )}
          {previewReceipt && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {previewReceipt.amount != null && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Valor</span>
                  <span className="font-bold text-foreground">{fmt.money(previewReceipt.amount)}</span>
                </div>
              )}
              {previewReceipt.date && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Data</span>
                  <span className="font-medium text-foreground">{previewReceipt.date}</span>
                </div>
              )}
              {previewReceipt.category && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Categoria</span>
                  <span className="font-medium text-foreground">{previewReceipt.category}</span>
                </div>
              )}
              {previewReceipt.confidence != null && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-xs text-muted-foreground block mb-0.5">Confiança IA</span>
                  <span className="font-medium text-foreground">{previewReceipt.confidence}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir recibo">
        <p className="text-muted-foreground mb-6">
          Tem certeza que deseja excluir este recibo? A imagem será removida permanentemente.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteId(null)}
            className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </Modal>
    </>
  );
}
