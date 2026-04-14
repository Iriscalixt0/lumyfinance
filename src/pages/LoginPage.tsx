import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/logo";
import { useTranslations } from "@/lib/i18n";
import { Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const t = useTranslations("auth.login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials"
        ? t("errorInvalidCredentials")
        : error.message);
      setLoading(false);
      return;
    }

    navigate("/dashboard");
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setError(error.message);
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel - decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative text-center text-primary-foreground max-w-md">
          <Logo size="lg" className="mx-auto mb-8" />
          <h1 className="text-4xl font-bold mb-4">{t("welcomeBack")}</h1>
          <p className="text-lg opacity-90">
            {t("welcomeSubtitle")}
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Logo size="sm" />
            <span className="text-xl font-bold text-gradient-hero">Lumyf</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{t("title")}</h2>
          <p className="text-muted-foreground mb-8">
            {t("subtitle")}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleSocialLogin("google")}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/80 transition-colors text-sm font-semibold text-foreground disabled:opacity-50"
            >
              {socialLoading === "google" ? (
                <div className="h-5 w-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {t("continueGoogle")}
            </button>

          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">{t("orEmail")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {t("password")}
                </label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-secondary/50 px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  {t("submit")}
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              {t("createAccount")}
            </Link>
          </p>

          <Link to="/" className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
