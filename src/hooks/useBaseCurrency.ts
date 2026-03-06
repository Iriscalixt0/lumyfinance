import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/utils/exchange";

/**
 * Hook that reads/writes the user's preferred base currency from their profile.
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

    supabase
      .from("profiles")
      .select("preferred_currency")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.preferred_currency) {
          setCurrencyState(data.preferred_currency as CurrencyCode);
          localStorage.setItem("lmyf_base_currency", data.preferred_currency);
        }
        setLoading(false);
      });
  }, [user]);

  const setCurrency = useCallback(async (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem("lmyf_base_currency", code);
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_currency: code })
        .eq("id", user.id);
    }
  }, [user]);

  return { currency, setCurrency, loading };
}
