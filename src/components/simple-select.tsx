"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

type SimpleSelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  id?: string;
  "aria-label"?: string;
  required?: boolean;
  className?: string;
};

export function SimpleSelect(props: SimpleSelectProps) {
  const {
    options,
    value,
    onChange,
    name,
    id,
    "aria-label": ariaLabel,
    className = "",
  } = props;
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  function updateDropdownPosition() {
    const el = containerRef.current;
    if (!el || typeof document === "undefined") return;
    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-simple-select-list]")) return;
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    updateDropdownPosition();
    const ro = new ResizeObserver(updateDropdownPosition);
    ro.observe(containerRef.current);
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [open]);

  const dropdownList = open && (
    <ul
      data-simple-select-list
      role="listbox"
      className="fixed z-[9999] max-h-60 overflow-auto bg-card border border-border rounded-xl shadow-lg py-1"
      style={{
        top: dropdownStyle.top,
        left: dropdownStyle.left,
        minWidth: dropdownStyle.minWidth,
      }}
    >
      {options.map((opt) => (
        <li
          key={opt.value}
          role="option"
          aria-selected={value === opt.value}
          onClick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-secondary/80 ${
            value === opt.value ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
          }`}
        >
          <span>{opt.label}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} readOnly aria-hidden required={props.required} />
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-foreground text-left flex items-center justify-between gap-2"
      >
        <span className="truncate">{selected?.label ?? options[0]?.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined" && dropdownList && createPortal(dropdownList, document.body)}
    </div>
  );
}
