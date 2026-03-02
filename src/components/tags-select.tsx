"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/** Valores possíveis de tag (chaves fixas no DB). */
export const TAG_VALUES = [
  "fixo",
  "variavel",
  "recorrente",
  "nao_recorrente",
  "investimento",
  "custo",
  "despesa",
] as const;

export function TagsSelect({
  value,
  onChange,
  name,
  placeholder = "Selecione o tipo...",
  labels,
  single = false,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  name: string;
  placeholder?: string;
  /** Mapa valor → label traduzido (ex.: { fixo: "Fixed", variavel: "Variable" }). */
  labels: Record<string, string>;
  /** Se true, permite apenas uma opção selecionada (comportamento de rádio). */
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(tag: string) {
    if (single) {
      if (value.includes(tag)) {
        onChange([]);
      } else {
        onChange([tag]);
      }
    } else {
      if (value.includes(tag)) {
        onChange(value.filter((t) => t !== tag));
      } else {
        onChange([...value, tag]);
      }
    }
  }

  const tagsValueStr = value.join(", ");
  const tagsDisplayStr = value.map((v) => labels[v] ?? v).join(", ");

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={tagsValueStr} readOnly aria-hidden />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-foreground text-left flex items-center justify-between gap-2"
      >
        <span className={`truncate min-w-0 ${value.length === 0 ? "text-muted-foreground" : ""}`}>
          {value.length > 0 ? tagsDisplayStr : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable={!single}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-card border border-border rounded-xl shadow-lg py-1"
        >
          {TAG_VALUES.map((tagValue) => {
            const isSelected = value.includes(tagValue);
            return (
              <li
                key={tagValue}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(tagValue)}
                className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-secondary/80 ${
                  isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                }`}
              >
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
                <span>{labels[tagValue] ?? tagValue}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
