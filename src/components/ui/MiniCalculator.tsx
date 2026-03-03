import { useState, useRef, useEffect } from "react";
import { Calculator, Plus, Minus, X, Equal, Delete } from "lucide-react";

interface MiniCalculatorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MiniCalculator({ value, onChange, placeholder = "0,00" }: MiniCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [items, setItems] = useState<{ label: string; value: number }[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const total = items.reduce((s, i) => s + i.value, 0);

  function addItem() {
    const cleaned = currentInput.replace(",", ".").trim();
    const num = parseFloat(cleaned);
    if (isNaN(num) || num <= 0) return;
    setItems((prev) => [...prev, { label: currentInput, value: num }]);
    setCurrentInput("");
    inputRef.current?.focus();
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function applyTotal() {
    const formatted = total.toFixed(2).replace(".", ",");
    onChange(formatted);
    setOpen(false);
    setItems([]);
    setCurrentInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  // Check if value contains expression (e.g. "10+20+30")
  const hasExpression = /[+\-*/]/.test(value);
  const evaluatedHint = (() => {
    if (!hasExpression) return null;
    try {
      const expr = value.replace(/,/g, ".").replace(/[^0-9.+\-*/()]/g, "");
      const result = Function(`"use strict"; return (${expr})`)();
      return typeof result === "number" && isFinite(result) ? result : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="relative" ref={panelRef}>
      <div className="relative">
        <input
          type="text"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "=" && evaluatedHint !== null) {
              e.preventDefault();
              onChange(evaluatedHint.toFixed(2).replace(".", ","));
            }
          }}
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
          title="Mini calculadora"
        >
          <Calculator className="h-4 w-4" />
        </button>
      </div>

      {/* Inline expression hint */}
      {evaluatedHint !== null && (
        <p className="text-[10px] text-primary mt-0.5 ml-1">
          = {evaluatedHint.toFixed(2).replace(".", ",")} <span className="text-muted-foreground">(pressione = para aplicar)</span>
        </p>
      )}

      {/* Calculator panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg p-4 space-y-3 animate-fade">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-primary" />
              Somar itens
            </h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Input + add */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: 12,50"
              autoFocus
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!currentInput.trim()}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 rounded-lg bg-muted/50 group">
                  <span className="text-sm text-foreground">
                    {i > 0 && <span className="text-muted-foreground mr-1">+</span>}
                    {item.value.toFixed(2).replace(".", ",")}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Total + apply */}
          {items.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1.5">
                <Equal className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {total.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({items.length} {items.length === 1 ? "item" : "itens"})
                </span>
              </div>
              <button
                type="button"
                onClick={applyTotal}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Usar total
              </button>
            </div>
          )}

          {items.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Adicione valores da nota fiscal e aplique o total ao campo de valor.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
