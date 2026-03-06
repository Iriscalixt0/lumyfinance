import { useState, useEffect, useMemo } from "react";
import { useBaseCurrency } from "@/hooks/useBaseCurrency";
import { SUPPORTED_CURRENCIES, convertCurrency, formatAmount, type CurrencyCode } from "@/lib/utils/exchange";
import { Plane, ArrowRightLeft, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export function TravelModePage() {
  const { currency: baseCurrency } = useBaseCurrency();
  const { toast } = useToast();

  const [active, setActive] = useState(() => localStorage.getItem("lmyf_travel_mode") === "true");
  const [travelCurrency, setTravelCurrency] = useState<CurrencyCode>(
    () => (localStorage.getItem("lmyf_travel_currency") as CurrencyCode) || "USD"
  );
  const [testAmount, setTestAmount] = useState("100");
  const [converted, setConverted] = useState<{ amount: number; rate: number } | null>(null);
  const [converting, setConverting] = useState(false);

  // Available currencies excluding base
  const availableCurrencies = useMemo(
    () => SUPPORTED_CURRENCIES.filter((c) => c.code !== baseCurrency),
    [baseCurrency]
  );

  function toggleTravelMode() {
    const next = !active;
    setActive(next);
    localStorage.setItem("lmyf_travel_mode", String(next));
    if (next) {
      localStorage.setItem("lmyf_travel_currency", travelCurrency);
      toast("Modo Viagem ativado! ✈️");
    } else {
      toast("Modo Viagem desativado");
    }
  }

  function selectCurrency(code: CurrencyCode) {
    setTravelCurrency(code);
    localStorage.setItem("lmyf_travel_currency", code);
    setConverted(null);
  }

  // Live conversion preview
  useEffect(() => {
    const amountNum = parseFloat(testAmount);
    if (!amountNum || amountNum <= 0 || travelCurrency === baseCurrency) {
      setConverted(null);
      return;
    }

    setConverting(true);
    const cents = Math.round(amountNum * 100);
    convertCurrency(cents, travelCurrency, baseCurrency).then((result) => {
      setConverted({ amount: result.convertedCents, rate: result.rate });
      setConverting(false);
    });
  }, [testAmount, travelCurrency, baseCurrency]);

  const baseCurrencyInfo = SUPPORTED_CURRENCIES.find((c) => c.code === baseCurrency);
  const travelCurrencyInfo = SUPPORTED_CURRENCIES.find((c) => c.code === travelCurrency);

  return (
    <div className="animate-fade space-y-6 max-w-xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Plane className="h-7 w-7 text-primary" />
          Modo Viagem
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registre gastos na moeda local e veja automaticamente quanto custou na sua moeda.
        </p>
      </div>

      {/* Toggle */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Ativar Modo Viagem</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transações serão registradas em {travelCurrency} e convertidas para {baseCurrency}
            </p>
          </div>
          <button
            onClick={toggleTravelMode}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
              active ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                active ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Currency selection */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Moeda do destino</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Em qual moeda você vai gastar durante a viagem?
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {availableCurrencies.map((cur) => (
            <button
              key={cur.code}
              onClick={() => selectCurrency(cur.code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm ${
                travelCurrency === cur.code
                  ? "border-primary bg-primary/5 font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:bg-secondary"
              }`}
            >
              <span>{cur.flag}</span>
              <span>{cur.code}</span>
              {travelCurrency === cur.code && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
            </button>
          ))}
        </div>
      </section>

      {/* Conversion preview */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Simulador de conversão</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Veja quanto um gasto na viagem custa na sua moeda
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Travel currency input */}
          <div className="flex-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
              {travelCurrencyInfo?.flag} {travelCurrency}
            </label>
            <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-4 py-3">
              <span className="text-sm text-muted-foreground font-medium">{travelCurrencyInfo?.symbol}</span>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="bg-transparent text-foreground text-lg font-bold w-full focus:outline-none"
                placeholder="100"
                min="0"
              />
            </div>
          </div>

          <ArrowRightLeft className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-5" />

          {/* Base currency result */}
          <div className="flex-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
              {baseCurrencyInfo?.flag} {baseCurrency}
            </label>
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              {converting ? (
                <span className="text-sm text-muted-foreground animate-pulse">Convertendo...</span>
              ) : converted ? (
                <span className="text-lg font-bold text-foreground">
                  {formatAmount(converted.amount, baseCurrency)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>

        {converted && (
          <p className="text-xs text-muted-foreground text-center">
            Taxa: 1 {travelCurrency} = {converted.rate.toFixed(4)} {baseCurrency}
          </p>
        )}
      </section>

      {/* Info */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          💡 <strong className="text-foreground">Como funciona:</strong> Com o Modo Viagem ativo, ao digitar no Magic Input
          (ex: "Táxi 25"), o valor será interpretado em <strong className="text-foreground">{travelCurrency}</strong> e
          automaticamente convertido para <strong className="text-foreground">{baseCurrency}</strong>. Você verá ambos os
          valores na lista de transações.
        </p>
      </div>
    </div>
  );
}
