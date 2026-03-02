"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Atrasados" },
  { value: "paid", label: "Pagos" },
] as const;

const DEBOUNCE_MS = 400;

export function CobrancasFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localName, setLocalName] = useState(() => searchParams.get("name") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = searchParams.get("status") ?? "";
  const fromDate = searchParams.get("fromDate") ?? "";
  const toDate = searchParams.get("toDate") ?? "";

  // Sincronizar do URL para estado local quando a URL mudar externamente
  const nameFromUrl = searchParams.get("name") ?? "";
  useEffect(() => {
    setLocalName(nameFromUrl);
  }, [searchParams, nameFromUrl]);

  const applyNameToUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("name", value);
      else params.delete("name");
      startTransition(() => {
        router.push(`/dashboard/cobrancas?${params.toString()}`);
      });
    },
    [searchParams, router]
  );

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setLocalName(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      applyNameToUrl(value);
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    const name = e.target.name;
    const value = e.target.value;

    if (name === "name") {
      handleNameChange(e as React.ChangeEvent<HTMLInputElement>);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    startTransition(() => {
      router.push(`/dashboard/cobrancas?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 self-center" aria-hidden />
      )}
      <div className="min-w-[180px] flex-1">
        <label htmlFor="filter-name" className="block text-xs font-medium text-muted-foreground mb-1">
          Cliente (nome)
        </label>
        <input
          id="filter-name"
          name="name"
          type="text"
          value={localName}
          onChange={handleNameChange}
          placeholder="Buscar por nome..."
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="filter-status" className="block text-xs font-medium text-muted-foreground mb-1">
          Status
        </label>
        <select
          id="filter-status"
          name="status"
          value={status}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="filter-from" className="block text-xs font-medium text-muted-foreground mb-1">
          Vencimento de
        </label>
        <input
          id="filter-from"
          name="fromDate"
          type="date"
          value={fromDate}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="filter-to" className="block text-xs font-medium text-muted-foreground mb-1">
          até
        </label>
        <input
          id="filter-to"
          name="toDate"
          type="date"
          value={toDate}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
