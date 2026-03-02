"use client";

import { useEffect, useState } from "react";

/**
 * Hook para obter o país detectado do usuário (geolocalização via servidor).
 * Usado para exibir símbolo de moeda correto (R$ ou US$) nos componentes de preço.
 */
export function useUserCountry(): string | null {
  const [country, setCountry] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo/country")
      .then((res) => res.json())
      .then((data: { country?: string | null }) => {
        if (!cancelled && typeof data.country === "string") setCountry(data.country);
      })
      .catch(() => {
        if (!cancelled) setCountry(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return loaded ? country : null;
}
