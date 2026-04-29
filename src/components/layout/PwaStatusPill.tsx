import { useState } from "react";
import { usePwaStatus, formatRelativeTime, type SwState } from "@/hooks/use-pwa-status";

const swLabel: Record<SwState, string> = {
  active: "ativo",
  registered: "registrado",
  inactive: "inativo",
  unsupported: "n/d",
};

const swColor: Record<SwState, string> = {
  active: "bg-emerald-500",
  registered: "bg-amber-400",
  inactive: "bg-muted-foreground/50",
  unsupported: "bg-muted-foreground/30",
};

/**
 * Compact PWA health pill — designed for the global footer.
 * 4 dots: SW, precache, online. Click to expand details.
 */
export function PwaStatusPill() {
  const [open, setOpen] = useState(false);
  const { swState, precachePopulated, precacheCount, lastUpdate, online } = usePwaStatus();

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Status do PWA"
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${swColor[swState]}`} aria-hidden />
        <span className={`h-1.5 w-1.5 rounded-full ${precachePopulated ? "bg-emerald-500" : "bg-muted-foreground/40"}`} aria-hidden />
        <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
        <span className="ml-1 hidden sm:inline">PWA</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div
            role="dialog"
            aria-label="Detalhes do PWA"
            className="absolute bottom-full right-0 mb-2 z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg text-xs"
          >
            <div className="font-semibold text-foreground mb-2">Status do PWA</div>
            <ul className="space-y-1.5">
              <Row
                label="Service Worker"
                value={swLabel[swState]}
                dotClass={swColor[swState]}
              />
              <Row
                label="Precache"
                value={precachePopulated ? `${precacheCount} arquivos` : "vazio"}
                dotClass={precachePopulated ? "bg-emerald-500" : "bg-muted-foreground/40"}
              />
              <Row
                label="Última atualização"
                value={formatRelativeTime(lastUpdate)}
                dotClass={lastUpdate ? "bg-emerald-500" : "bg-muted-foreground/40"}
              />
              <Row
                label="Conexão"
                value={online ? "online" : "offline"}
                dotClass={online ? "bg-emerald-500" : "bg-red-500"}
              />
            </ul>
            <p className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground leading-snug">
              PWA só funciona na versão publicada. No preview o SW fica inativo (esperado).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, dotClass }: { label: string; value: string; dotClass: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
        {label}
      </span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </li>
  );
}
