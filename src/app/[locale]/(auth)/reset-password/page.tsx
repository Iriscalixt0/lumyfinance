"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = useMemo(
    () => password.length >= 6 && password === confirmPassword,
    [password, confirmPassword]
  );

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        if (!session) {
          setInfo("Abra novamente o link de recuperacao enviado para seu e-mail.");
        }
      } catch {
        if (mounted) setError(tErrors("connectError"));
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    void checkRecoverySession();
    return () => {
      mounted = false;
    };
  }, [tErrors]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("A nova senha deve ter no minimo 6 caracteres.");
      return;
    }
    if (!passwordsMatch) {
      setError("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tErrors("connectError"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    router.replace("/login");
    return (
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card text-center">
          <Link
            href="/"
            className="flex justify-center items-center gap-2 text-foreground font-bold tracking-tight mb-8 w-full"
          >
            <Logo size="sm" />
            <span className="text-gradient-hero">{tCommon("brand")}</span>
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 font-sans">
            Senha atualizada com sucesso
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Você foi desconectado. Faça login novamente com sua nova senha.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecionando para o login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card">
        <Link
          href="/"
          className="flex justify-center items-center gap-2 text-foreground font-bold tracking-tight mb-8 w-full"
        >
          <Logo size="sm" />
          <span className="text-gradient-hero">{tCommon("brand")}</span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2 font-sans">
          Definir nova senha
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Digite sua nova senha para concluir a recuperacao.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              Nova senha
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 pr-11 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="Nova senha (min. 6 caracteres)"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="relative">
            <label htmlFor="confirmPassword" className="sr-only">
              Confirmar nova senha
            </label>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 pr-11 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="Confirme a nova senha"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {checkingSession && (
            <p className="text-sm text-muted-foreground">Validando link de recuperacao...</p>
          )}
          {error && (
            <p className="text-sm text-rose-600 font-medium" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-amber-700 font-medium" role="status">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || checkingSession}
            className="w-full bg-hero-gradient text-primary-foreground font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              "Atualizar senha"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
