"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

/**
 * Se o usuário chegou em qualquer página com o hash de recuperação de senha
 * (type=recovery), redireciona para /reset-password preservando o hash.
 * Isso cobre o caso em que o Supabase redireciona para a URL base em vez da
 * página de reset (ex: por configuração de Redirect URLs no dashboard).
 */
export function RecoveryRedirect() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    if (type !== "recovery") return;

    const currentPath = pathname || "/";

    // Se já estamos em reset-password, não redirecionar
    if (currentPath.endsWith("/reset-password") || currentPath.includes("/reset-password")) {
      return;
    }

    // Usar window.location para preservar o hash (necessário para o Supabase processar)
    window.location.replace(`/${locale}/reset-password${hash}`);
  }, [pathname, locale]);

  return null;
}
