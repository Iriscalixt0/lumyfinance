"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type BlockReason = "plan" | "viewer";

type VisitorContextValue = {
  isVisitor: boolean;
  isViewer: boolean;
  /** Se false, usuário não pode executar ações (ex.: transações, investimentos); pode apenas visualizar. */
  hasActivePlan: boolean;
  /** Retorna false se ação bloqueada (visitante ou plano inativo). Exibe mensagem na própria página; não redireciona. Chamar antes de executar ações. */
  requirePro: () => boolean;
  /** Mensagem "precisa assinar" está visível e fica fixa até a pessoa ativar o plano. */
  showRequirePlanReminder: boolean;
};

const VisitorContext = createContext<VisitorContextValue | null>(null);

export function VisitorProvider({
  isVisitor,
  isViewer = false,
  hasActivePlan = true,
  isInActiveBeta = false,
  showPlanReminderOnPath = false,
  onRequireProBlocked,
  children,
}: {
  isVisitor: boolean;
  isViewer?: boolean;
  hasActivePlan?: boolean;
  /** Modo teste com link: não exibe mensagem de plano e permite ações. */
  isInActiveBeta?: boolean;
  /** Quando true (usuário está em aba que exige plano sem plano ativo), exibe a mensagem em todas essas abas. */
  showPlanReminderOnPath?: boolean;
  /** Chamado quando requirePro() bloqueia a ação (ex.: para exibir toast). */
  onRequireProBlocked?: (reason: BlockReason) => void;
  children: React.ReactNode;
}) {
  const [showRequirePlanReminder, setShowRequirePlanReminder] = useState(false);

  const requirePro = useCallback(() => {
    if (isViewer) {
      onRequireProBlocked?.("viewer");
      return false;
    }
    if (isInActiveBeta) return true;
    const cannotExecute = isVisitor || !hasActivePlan;
    if (cannotExecute) {
      setShowRequirePlanReminder(true);
      onRequireProBlocked?.("plan");
      return false;
    }
    return true;
  }, [hasActivePlan, isInActiveBeta, isViewer, isVisitor, onRequireProBlocked]);

  /** Em abas que exigem plano (transações, investimentos, etc.), exibe a mensagem e rola até ela. Não em modo teste. */
  useEffect(() => {
    if (showPlanReminderOnPath && !isInActiveBeta) setShowRequirePlanReminder(true);
  }, [showPlanReminderOnPath, isInActiveBeta]);

  /** Esconde o aviso quando a pessoa ativa o plano ou está no modo teste com link. */
  useEffect(() => {
    if (hasActivePlan || isInActiveBeta) setShowRequirePlanReminder(false);
  }, [hasActivePlan, isInActiveBeta]);

  const value: VisitorContextValue = {
    isVisitor,
    isViewer,
    hasActivePlan,
    requirePro,
    showRequirePlanReminder,
  };

  return (
    <VisitorContext.Provider value={value}>
      {children}
    </VisitorContext.Provider>
  );
}

export function useVisitor(): VisitorContextValue {
  const ctx = useContext(VisitorContext);
  if (!ctx) {
    return {
      isVisitor: false,
      isViewer: false,
      hasActivePlan: true,
      requirePro: () => true,
      showRequirePlanReminder: false,
    };
  }
  return ctx;
}
