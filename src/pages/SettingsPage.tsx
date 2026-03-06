import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/components/theme-provider";
import { useBaseCurrency } from "@/hooks/useBaseCurrency";
import { SUPPORTED_CURRENCIES } from "@/lib/utils/exchange";
import { Modal } from "@/components/ui/Modal";
import {
  Settings,
  User,
  Eye,
  MapPin,
  CreditCard,
  Sun,
  Moon,
  Check,
  LogOut,
  Trash2,
  Coins,
} from "lucide-react";

const COLOR_THEMES = [
  { value: "", label: "Padrão", color: "160 45% 35%" },
  { value: "rosa", label: "Rosa", color: "330 65% 45%" },
  { value: "azul", label: "Azul", color: "217 70% 45%" },
  { value: "amarelo", label: "Amarelo", color: "38 92% 50%" },
];

const FONT_SIZES = [
  { value: "", label: "Normal" },
  { value: "grande", label: "Grande" },
  { value: "muito-grande", label: "Muito grande" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [colorTheme, setColorTheme] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [locationConsent, setLocationConsent] = useState<boolean | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (user) setEmail(user.email || "");
    setColorTheme(localStorage.getItem("lmyf_color_theme") || "");
    setFontSize(localStorage.getItem("lmyf_font_size") || "");
    setHighContrast(localStorage.getItem("lmyf_high_contrast") === "true");
    setReducedMotion(localStorage.getItem("lmyf_reduced_motion") === "true");
    const loc = localStorage.getItem("lmyf_location_consent");
    setLocationConsent(loc === null ? null : loc === "true");
  }, [user]);

  useEffect(() => {
    async function loadPlan() {
      if (!activeWorkspace) return;
      const { data } = await supabase
        .from("workspaces")
        .select("stripe_subscription_id")
        .eq("id", activeWorkspace.id)
        .single();
      setHasPlan(!!data?.stripe_subscription_id);
    }
    loadPlan();
  }, [activeWorkspace]);

  function applyColorTheme(value: string) {
    setColorTheme(value);
    localStorage.setItem("lmyf_color_theme", value);
    document.documentElement.setAttribute("data-color-theme", value);
  }

  function applyFontSize(value: string) {
    setFontSize(value);
    localStorage.setItem("lmyf_font_size", value);
    document.documentElement.setAttribute("data-font-size", value);
  }

  function toggleHighContrast() {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem("lmyf_high_contrast", String(next));
    document.documentElement.setAttribute("data-high-contrast", String(next));
  }

  function toggleReducedMotion() {
    const next = !reducedMotion;
    setReducedMotion(next);
    localStorage.setItem("lmyf_reduced_motion", String(next));
    document.documentElement.setAttribute("data-reduced-motion", String(next));
  }

  function setLocation(allow: boolean) {
    setLocationConsent(allow);
    localStorage.setItem("lmyf_location_consent", String(allow));
    toast(allow ? "Localização permitida." : "Localização negada.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="animate-fade space-y-6 max-w-xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie sua conta, espaço de trabalho e plano.
        </p>
      </div>

      {/* ── Conta ── */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Conta</h2>
          </div>
          <p className="text-xs text-muted-foreground">Dados da conta logada.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
            E-mail
          </label>
          <input
            type="email"
            readOnly
            value={email}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm cursor-default focus:outline-none"
          />
        </div>
      </section>

      {/* ── Visual e acessibilidade ── */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Visual e acessibilidade</h2>
          </div>
        </div>

        {/* Row: Tema + Alto contraste */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Sun className="h-3.5 w-3.5" /> Tema
            </label>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors w-full"
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "dark" ? "Modo Escuro" : "Modo Claro"}
            </button>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Eye className="h-3.5 w-3.5" /> Alto contraste
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-foreground cursor-pointer hover:bg-secondary transition-colors">
              <input
                type="checkbox"
                checked={highContrast}
                onChange={toggleHighContrast}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              {highContrast ? "Ativado" : "Desativado"}
            </label>
          </div>
        </div>

        {/* Row: Menos animação + Fonte */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Settings className="h-3.5 w-3.5" /> Menos animação
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-foreground cursor-pointer hover:bg-secondary transition-colors">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={toggleReducedMotion}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              {reducedMotion ? "Ativado" : "Desativado"}
            </label>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              Ŧ Fonte
            </label>
            <div className="flex gap-1.5">
              {FONT_SIZES.map((fs) => (
                <button
                  key={fs.value}
                  onClick={() => applyFontSize(fs.value)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    fontSize === fs.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border-border"
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Paleta */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Paleta</label>
          <div className="flex gap-3">
            {COLOR_THEMES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => applyColorTheme(ct.value)}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={`h-9 w-9 rounded-full border-2 transition-all flex items-center justify-center ${
                    colorTheme === ct.value
                      ? "border-foreground scale-110"
                      : "border-transparent group-hover:border-border"
                  }`}
                  style={{ backgroundColor: `hsl(${ct.color})` }}
                >
                  {colorTheme === ct.value && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <span className="text-[10px] text-muted-foreground">{ct.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Localização ── */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Localização</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Permita localização para melhorar contexto regional (idioma, fuso horário e experiências locais).
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setLocation(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              locationConsent === true
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground hover:bg-secondary"
            }`}
          >
            Permitir localização
          </button>
          <button
            onClick={() => setLocation(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              locationConsent === false
                ? "bg-destructive/10 text-destructive border-destructive/30"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            Não permitir
          </button>
        </div>
      </section>

      {/* ── Plano e cobrança ── */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Plano e cobrança</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Assine o Pro, gerencie sua assinatura, forma de pagamento e faturas aqui.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Plano atual
          </label>
          <div
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
              hasPlan
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-destructive/5 text-destructive border border-destructive/20"
            }`}
          >
            {hasPlan ? "Plano Pro ativo ✓" : "Sem assinatura ativa"}
          </div>
        </div>

        {!hasPlan && (
          <button
            onClick={() => navigate("/plan")}
            className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Pro — R$19,90/mês • 7 dias grátis
          </button>
        )}
      </section>

      {/* ── Footer actions ── */}
      <div className="space-y-3 pt-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sair da conta (graphyx.s...)
        </button>
        <button
          onClick={() => setDeleteModalOpen(true)}
          className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
        >
          <Trash2 className="h-4 w-4" /> Excluir minha conta
        </button>
      </div>

      {/* Footer links */}
      <div className="text-center pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground tracking-wide">
          <a href="#" className="hover:text-foreground transition-colors">TERMOS</a>
          {" / "}
          <a href="#" className="hover:text-foreground transition-colors">PRIVACIDADE</a>
          {" / "}
          <a href="#" className="hover:text-foreground transition-colors">REEMBOLSO</a>
        </p>
      </div>

      {/* Delete account modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir conta">
        <p className="text-muted-foreground mb-6 text-sm">
          Tem certeza que deseja excluir sua conta? Todos os seus dados serão removidos permanentemente. Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModalOpen(false)}
            className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button className="px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity">
            Excluir permanentemente
          </button>
        </div>
      </Modal>
    </div>
  );
}
