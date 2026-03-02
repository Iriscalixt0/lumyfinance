"use client";

import { useVisitor } from "./visitor-context";
import { PlanRequiredMessage } from "./plan-required-message";

/** Exibe a mensagem "Para acessar o app, assine o plano Pro abaixo." quando não há plano ativo (centralizada, sem rolagem automática). */
export function VisitorReminder() {
  const { showRequirePlanReminder } = useVisitor();

  if (!showRequirePlanReminder) return null;

  return (
    <div className="mb-4 sm:mb-6 flex justify-center w-full">
      <PlanRequiredMessage />
    </div>
  );
}
