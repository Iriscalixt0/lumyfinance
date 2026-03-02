import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { getBetaParticipationForWorkspace } from "@/actions/beta";
import { DecisionForm } from "@/components/beta/decision-form";

const WORKSPACE_COOKIE = "workspace_id";

export default async function BetaDecisionPage() {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceId);

  const participation = await getBetaParticipationForWorkspace(workspace?.id ?? null);

  // Se não for beta ou não precisar de decisão, redirecionar para dashboard
  if (!participation || !participation.needsDecision || !workspace?.id) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <DecisionForm
        workspaceId={workspace.id}
        currentStatus={participation.status}
      />
    </div>
  );
}
