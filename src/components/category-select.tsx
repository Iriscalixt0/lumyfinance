"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import type { Category } from "@/types/database";

type CategorySelectProps = {
  value: string;
  onChange: (categoryId: string) => void;
  name: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  required?: boolean;
} & (
  | {
      expenseCategories: Category[];
      incomeCategories: Category[];
      expensesLabel: string;
      incomeLabel: string;
      placeholder?: string;
      categories?: never;
    }
  | {
      categories: Category[];
      placeholder?: string;
      expenseCategories?: never;
      incomeCategories?: never;
      expensesLabel?: never;
      incomeLabel?: never;
    }
);

export function CategorySelect(props: CategorySelectProps) {
  const {
    value,
    onChange,
    name,
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
  } = props;

  const tCat = useTranslations("categories");
  const systemNames: Record<string, string> = {
    wallet: tCat("defaults.wallet"),
    briefcase: tCat("defaults.briefcase"),
    gift: tCat("defaults.gift"),
    inbox: tCat("defaults.inbox"),
    "shopping-cart": tCat("defaults.shopping-cart"),
    home: tCat("defaults.home"),
    car: tCat("defaults.car"),
    "heart-pulse": tCat("defaults.heart-pulse"),
    "gamepad-2": tCat("defaults.gamepad-2"),
    "shopping-bag": tCat("defaults.shopping-bag"),
    box: tCat("defaults.box"),
  };
  function getCatName(c: Category) {
    return c.is_system && c.icon && systemNames[c.icon] ? systemNames[c.icon] : c.name;
  }

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isGrouped = "expenseCategories" in props && props.expenseCategories;
  const allCategories = isGrouped
    ? [
        ...props.expenseCategories!.map((c) => ({ ...c, group: "expense" as const })),
        ...props.incomeCategories!.map((c) => ({ ...c, group: "income" as const })),
      ]
    : (props as { categories: Category[] }).categories.map((c) => ({ ...c, group: null as const }));
  const selected = allCategories.find((c) => c.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} readOnly aria-hidden required={props.required} />
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-foreground text-left flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selected ? (
            <>
              <CategoryIcon
                icon={selected.icon ?? "box"}
                color={selected.color ?? undefined}
                className="w-5 h-5 shrink-0"
              />
              <span className="truncate">{getCatName(selected)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {props.placeholder ?? tCat("selectCategory")}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-card border border-border rounded-xl shadow-lg py-1"
        >
          {isGrouped ? (
            <>
              <li role="group" className="px-3 py-1.5">
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase">
                  {props.expensesLabel}
                </span>
              </li>
              {props.expenseCategories!.map((c) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={value === c.id}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-secondary/80 ${
                    value === c.id ? "bg-primary/10 text-primary" : "text-foreground"
                  }`}
                >
                  <CategoryIcon icon={c.icon ?? "box"} color={c.color ?? undefined} className="w-5 h-5 shrink-0" />
                  <span>{getCatName(c)}</span>
                </li>
              ))}
              <li role="group" className="px-3 py-1.5 pt-2">
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-600 uppercase">
                  {props.incomeLabel}
                </span>
              </li>
              {props.incomeCategories!.map((c) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={value === c.id}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-secondary/80 ${
                    value === c.id ? "bg-primary/10 text-primary" : "text-foreground"
                  }`}
                >
                  <CategoryIcon icon={c.icon ?? "box"} color={c.color ?? undefined} className="w-5 h-5 shrink-0" />
                  <span>{getCatName(c)}</span>
                </li>
              ))}
            </>
          ) : (
            <>
              {"placeholder" in props && props.placeholder && (
                <li
                  role="option"
                  aria-selected={value === ""}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-secondary/80 ${
                    value === "" ? "bg-primary/10 text-primary" : "text-foreground"
                  }`}
                >
                  <span className="text-muted-foreground">{props.placeholder}</span>
                </li>
              )}
              {(props as { categories: Category[] }).categories.map((c) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={value === c.id}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-secondary/80 ${
                    value === c.id ? "bg-primary/10 text-primary" : "text-foreground"
                  }`}
                >
                  <CategoryIcon icon={c.icon ?? "box"} color={c.color ?? undefined} className="w-5 h-5 shrink-0" />
                  <span>{getCatName(c)}</span>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
