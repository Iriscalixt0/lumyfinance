import { useState } from "react";
import { formatBRL } from "@/lib/utils/currency";
import { Calculator, Percent, Home, Car, Gift, TrendingUp, ArrowRight } from "lucide-react";

type CalcType = "compound" | "financing" | "thirteenth" | "investment";

const CALC_TABS: { id: CalcType; label: string; icon: typeof Calculator }[] = [
  { id: "compound", label: "Juros Compostos", icon: Percent },
  { id: "financing", label: "Financiamento", icon: Home },
  { id: "thirteenth", label: "Décimo Terceiro", icon: Gift },
  { id: "investment", label: "Simulador de Investimento", icon: TrendingUp },
];

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CompoundInterest() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [monthly, setMonthly] = useState("");

  const p = parseFloat(principal.replace(",", ".")) || 0;
  const r = (parseFloat(rate.replace(",", ".")) || 0) / 100;
  const n = parseInt(months) || 0;
  const m = parseFloat(monthly.replace(",", ".")) || 0;

  const futureValue = p * Math.pow(1 + r, n) + m * ((Math.pow(1 + r, n) - 1) / (r || 1));
  const totalInvested = p + m * n;
  const interest = futureValue - totalInvested;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Capital inicial (R$)" value={principal} onChange={setPrincipal} placeholder="10.000" />
        <Field label="Taxa mensal (%)" value={rate} onChange={setRate} placeholder="1,0" />
        <Field label="Período (meses)" value={months} onChange={setMonths} placeholder="24" />
        <Field label="Aporte mensal (R$)" value={monthly} onChange={setMonthly} placeholder="500" />
      </div>
      {n > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-2">
          <ResultCard label="Total investido" value={totalInvested * 100} color="text-foreground" />
          <ResultCard label="Juros ganhos" value={interest * 100} color="text-emerald-500" />
          <ResultCard label="Montante final" value={futureValue * 100} color="text-primary" />
        </div>
      )}
    </div>
  );
}

function Financing() {
  const [total, setTotal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");

  const p = parseFloat(total.replace(",", ".")) || 0;
  const r = (parseFloat(rate.replace(",", ".")) || 0) / 100;
  const n = parseInt(months) || 0;

  const installment = r > 0 && n > 0 ? p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
  const totalPaid = installment * n;
  const interestPaid = totalPaid - p;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor financiado (R$)" value={total} onChange={setTotal} placeholder="200.000" />
        <Field label="Taxa mensal (%)" value={rate} onChange={setRate} placeholder="0,99" />
        <Field label="Prazo (meses)" value={months} onChange={setMonths} placeholder="360" />
      </div>
      {n > 0 && installment > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-2">
          <ResultCard label="Parcela mensal" value={installment * 100} color="text-primary" />
          <ResultCard label="Total pago" value={totalPaid * 100} color="text-foreground" />
          <ResultCard label="Juros pagos" value={interestPaid * 100} color="text-destructive" />
        </div>
      )}
    </div>
  );
}

function ThirteenthSalary() {
  const [salary, setSalary] = useState("");
  const [workedMonths, setWorkedMonths] = useState("12");
  const [dependents, setDependents] = useState("0");

  const s = parseFloat(salary.replace(",", ".")) || 0;
  const m = Math.min(parseInt(workedMonths) || 0, 12);
  const gross = (s * m) / 12;

  // Simplified INSS/IRRF calculation
  let inss = 0;
  if (gross <= 1412) inss = gross * 0.075;
  else if (gross <= 2666.68) inss = gross * 0.09;
  else if (gross <= 4000.03) inss = gross * 0.12;
  else inss = gross * 0.14;
  inss = Math.min(inss, 908.85);

  const net = gross - inss;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Salário bruto (R$)" value={salary} onChange={setSalary} placeholder="5.000" />
        <Field label="Meses trabalhados" value={workedMonths} onChange={setWorkedMonths} placeholder="12" />
        <Field label="Dependentes" value={dependents} onChange={setDependents} placeholder="0" />
      </div>
      {s > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-2">
          <ResultCard label="13º bruto" value={gross * 100} color="text-foreground" />
          <ResultCard label="Desconto INSS" value={inss * 100} color="text-destructive" />
          <ResultCard label="13º líquido" value={net * 100} color="text-primary" />
        </div>
      )}
    </div>
  );
}

function InvestmentSimulator() {
  const [initial, setInitial] = useState("");
  const [monthly, setMonthly] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const p = parseFloat(initial.replace(",", ".")) || 0;
  const m = parseFloat(monthly.replace(",", ".")) || 0;
  const r = (parseFloat(rate.replace(",", ".")) || 0) / 100;
  const n = (parseInt(years) || 0) * 12;

  const futureValue = p * Math.pow(1 + r, n) + m * ((Math.pow(1 + r, n) - 1) / (r || 1));
  const totalInvested = p + m * n;
  const profit = futureValue - totalInvested;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Investimento inicial (R$)" value={initial} onChange={setInitial} placeholder="10.000" />
        <Field label="Aporte mensal (R$)" value={monthly} onChange={setMonthly} placeholder="1.000" />
        <Field label="Rentabilidade mensal (%)" value={rate} onChange={setRate} placeholder="0,8" />
        <Field label="Período (anos)" value={years} onChange={setYears} placeholder="10" />
      </div>
      {n > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-2">
          <ResultCard label="Total investido" value={totalInvested * 100} color="text-foreground" />
          <ResultCard label="Rendimento" value={profit * 100} color="text-emerald-500" />
          <ResultCard label="Patrimônio final" value={futureValue * 100} color="text-primary" />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function ResultCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
    </div>
  );
}

export function CalculatorsPage() {
  const [active, setActive] = useState<CalcType>("compound");

  const CalcComponent = {
    compound: CompoundInterest,
    financing: Financing,
    thirteenth: ThirteenthSalary,
    investment: InvestmentSimulator,
  }[active];

  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calculadoras Financeiras</h1>
        <p className="text-sm text-muted-foreground mt-1">Simule investimentos, financiamentos e muito mais.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {CALC_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground hover:bg-secondary"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calculator */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <CalcComponent />
      </div>
    </div>
  );
}
