import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/utils/exchange";

/**
 * Hook that reads/writes the user's preferred base currency from profile_preferences.
 * Falls back to localStorage → DEFAULT_CURRENCY.
 */
export function useBaseCurrency() {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyCode>(
    () => (localStorage.getItem("lmyf_base_currency") as CurrencyCode) || DEFAULT_CURRENCY
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const localCurrency = localStorage.getItem("lmyf_base_currency") as CurrencyCode | null;
    if (localCurrency) {
      setCurrencyState(localCurrency);
    }
    setLoading(false);
  }, [user]);

  const setCurrency = useCallback(async (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem("lmyf_base_currency", code);
  }, [user]);

  return { currency, setCurrency, loading };
}
