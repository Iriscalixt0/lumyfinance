import { useState, useEffect } from "react";
import { X, Zap, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useIntlFormat } from "@/hooks/useIntlFormat";
import { useTranslations } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { useGamification } from "@/hooks/useGamification";
import { MagicInput } from "@/components/transactions/MagicInput";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/utils/exchange";

interface QuickTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function QuickTransactionModal({ open, onClose, onSaved }: QuickTransactionModalProps) {
  const t = useTranslations("quickTransaction");
  const fmt = useIntlFormat();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { recordActivity } = useGamification(activeWorkspace?.id ?? null);
  const { toast: showToast } = useToast();
  const [key, setKey] = useState(0);

  const localeCurrency = (fmt.currency as CurrencyCode) || DEFAULT_CURRENCY;

  useEffect(() => {
    if (open) setKey(k => k + 1); // reset MagicInput on open
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl animate-fade mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground">Magic Input</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <MagicInput
            key={key}
            baseCurrency={localeCurrency}
            onSubmit={async (data) => {
              if (!activeWorkspace) return;

              // Find category id
              let categoryId: string | null = null;
              if (data.category) {
                const { data: cats } = await supabase
                  .from("categories")
                  .select("id, name")
                  .eq("workspace_id", activeWorkspace.id);
                const match = cats?.find(c => c.name.toLowerCase() === data.category!.toLowerCase());
                categoryId = match?.id ?? null;
              }

              const { error } = await supabase.from("transactions").insert({
                workspace_id: activeWorkspace.id,
                created_by: user!.id,
                description: data.description,
                amount: data.amount,
                type: data.type,
                date: data.date,
                category_id: categoryId,
                currency: data.currency,
                original_amount: data.originalAmount ?? null,
                exchange_rate: data.exchangeRate ?? null,
              });

              if (error) {
                console.error("[QuickTransaction] insert error:", error);
                showToast(error.message || t("error"), "error");
                return;
              }

              await recordActivity();
              showToast(t("saved"), "success");
              onSaved?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
