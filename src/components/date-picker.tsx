"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { getTodayISO } from "@/lib/utils/dates";

function getWeekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  return [0, 1, 2, 3, 4, 5, 6].map((d) =>
    formatter.format(new Date(2024, 0, 7 + d)) // Sun=7, Mon=8, ...
  );
}

function getDaysInMonth(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const result: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) result.push(null);
  for (let d = 1; d <= daysInMonth; d++) result.push(d);
  return result;
}

export function DatePicker({
  value,
  onChange,
  name,
  id,
  required,
  placeholder = "Selecione a data",
  clearLabel = "Limpar",
  todayLabel = "Hoje",
  locale = "pt-BR",
}: {
  value: string;
  onChange: (value: string) => void;
  name: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  clearLabel?: string;
  todayLabel?: string;
  locale?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [year, setYear] = useState(() => {
    if (value) {
      const [y] = value.split("-");
      return parseInt(y ?? String(new Date().getFullYear()), 10);
    }
    return new Date().getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (value) {
      const [, m] = value.split("-");
      return parseInt(m ?? "1", 10) - 1;
    }
    return new Date().getMonth();
  });

  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-");
      setYear(parseInt(y ?? String(new Date().getFullYear()), 10));
      setMonth(parseInt(m ?? "1", 10) - 1);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const days = getDaysInMonth(year, month);
  const displayValue = value
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
        new Date(value + "T12:00:00")
      )
    : "";
  const today = getTodayISO();

  function selectDay(day: number) {
    const d = String(day).padStart(2, "0");
    const m = String(month + 1).padStart(2, "0");
    onChange(`${year}-${m}-${d}`);
    setOpen(false);
  }

  function goPrevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const monthYearLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month, 1));

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} readOnly aria-hidden required={required} />
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-foreground text-left flex items-center justify-between gap-2"
      >
        <span className={`truncate flex items-center gap-2 ${!value ? "text-muted-foreground" : ""}`}>
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          {displayValue || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-card border border-border rounded-xl shadow-lg p-4 min-w-[280px]">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goPrevMonth}
              className="p-2 rounded-lg hover:bg-secondary/80 text-foreground"
              aria-label="Mês anterior"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            <span className="font-semibold text-foreground capitalize">
              {monthYearLabel}
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              className="p-2 rounded-lg hover:bg-secondary/80 text-foreground"
              aria-label="Próximo mês"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {getWeekdayLabels(locale).map((w) => (
              <div key={w} className="text-center text-xs font-medium text-muted-foreground py-1">
                {w}
              </div>
            ))}
            {days.map((d, i) => {
              if (d === null) {
                return <div key={`empty-${i}`} />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const isSelected = value === dateStr;
              const isToday = today === dateStr;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-primary/20 text-primary font-semibold"
                        : "hover:bg-secondary/80 text-foreground"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {clearLabel}
            </button>
            <button
              type="button"
              onClick={() => { onChange(getTodayISO()); setOpen(false); }}
              className="flex-1 py-2 text-sm font-medium text-primary hover:underline"
            >
              {todayLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
