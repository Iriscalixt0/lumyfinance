"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";

/**
 * Mensagem exibida quando o usuário tenta acessar transações, investimentos,
 * cobranças, metas, orçamentos, workspace etc. sem plano ativo.
 * Estilo: caixa com fundo verde-claro, ícone de cadeado e CTA para assinar.
 */
export function PlanRequiredMessage() {
  const t = useTranslations("billing");

  return (
    <div className="rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-foreground shadow-sm max-w-2xl bg-[#edf7f5] dark:bg-teal-950/40 dark:border dark:border-teal-800/50">
      <span
        className="shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-teal-600 dark:text-teal-400"
        aria-hidden
      >
        <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <p className="flex-1 text-sm sm:text-base font-medium text-teal-900/90 dark:text-teal-100">
        {t("subscribeToAccess")}
      </p>
      <Link
        href="/dashboard/plan"
        className="shrink-0 inline-flex items-center justify-center rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-semibold text-sm px-4 py-2.5 hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors"
      >
        {t("startPro")}
      </Link>
    </div>
  );
}
