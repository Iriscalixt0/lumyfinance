import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/components/theme-provider";
import { Settings, User, Palette, Type, Globe, Check } from "lucide-react";

const COLOR_THEMES = [
  { value: "", label: "Verde (padrão)", color: "160 45% 35%" },
  { value: "rosa", label: "Rosa", color: "330 65% 45%" },
  { value: "azul", label: "Azul", color: "217 70% 45%" },
  { value: "amarelo", label: "Amarelo", color: "38 92% 50%" },
];

const FONT_SIZES = [
  { value: "", label: "Normal" },
  { value: "grande", label: "Grande" },
  { value: "muito-grande", label: "Muito grande" },
];

const LANGUAGES = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "pt-PT", label: "Português (PT)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [colorTheme, setColorTheme] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [language, setLanguage] = useState("pt-BR");

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (data) setFullName(data.full_name || "");

      // Load saved preferences from localStorage
      setColorTheme(localStorage.getItem("lmyf_color_theme") || "");
      setFontSize(localStorage.getItem("lmyf_font_size") || "");
      setHighContrast(localStorage.getItem("lmyf_high_contrast") === "true");
      setReducedMotion(localStorage.getItem("lmyf_reduced_motion") === "true");
      setLanguage(localStorage.getItem("lmyf_language") || "pt-BR");
    }
    load();
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast("Erro ao salvar perfil."); return; }
    toast("Perfil atualizado!");
  }

  function applyColorTheme(value: string) {
    setColorTheme(value);
    localStorage.setItem("lmyf_color_theme", value);
    document.documentElement.setAttribute("data-color-theme", value);
    toast("Tema de cor aplicado!");
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

  function changeLanguage(value: string) {
    setLanguage(value);
    localStorage.setItem("lmyf_language", value);
    toast("Idioma alterado!");
  }

  return (
    <div className="animate-fade space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Personalize sua experiência</p>
      </div>

      {/* Profile */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Perfil</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nome completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full max-w-md bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="bg-hero-gradient text-primary-foreground font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </section>

      {/* Appearance */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Aparência</h2>
        </div>

        {/* Dark mode */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Modo escuro</p>
            <p className="text-xs text-muted-foreground">Alterne entre claro e escuro</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              theme === "dark" ? "bg-primary" : "bg-border"
            }`}
          >
            <div className={`absolute top-0.5 h-6 w-6 bg-card rounded-full shadow transition-transform ${
              theme === "dark" ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
        </div>

        {/* Color theme */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Cor principal</p>
          <div className="flex gap-3">
            {COLOR_THEMES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => applyColorTheme(ct.value)}
                className={`h-10 w-10 rounded-full border-2 transition-all flex items-center justify-center ${
                  colorTheme === ct.value ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: `hsl(${ct.color})` }}
                aria-label={ct.label}
              >
                {colorTheme === ct.value && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Type className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Acessibilidade</h2>
        </div>

        {/* Font size */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Tamanho da fonte</p>
          <div className="flex gap-2">
            {FONT_SIZES.map((fs) => (
              <button
                key={fs.value}
                onClick={() => applyFontSize(fs.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  fontSize === fs.value
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
                }`}
              >
                {fs.label}
              </button>
            ))}
          </div>
        </div>

        {/* High contrast */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Alto contraste</p>
            <p className="text-xs text-muted-foreground">Melhora a visibilidade de bordas e textos</p>
          </div>
          <button
            onClick={toggleHighContrast}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              highContrast ? "bg-primary" : "bg-border"
            }`}
          >
            <div className={`absolute top-0.5 h-6 w-6 bg-card rounded-full shadow transition-transform ${
              highContrast ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
        </div>

        {/* Reduced motion */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Reduzir animações</p>
            <p className="text-xs text-muted-foreground">Desativa transições e animações</p>
          </div>
          <button
            onClick={toggleReducedMotion}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              reducedMotion ? "bg-primary" : "bg-border"
            }`}
          >
            <div className={`absolute top-0.5 h-6 w-6 bg-card rounded-full shadow transition-transform ${
              reducedMotion ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </section>

      {/* Language */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Idioma</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => changeLanguage(lang.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                language === lang.value
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
