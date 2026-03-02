import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { getBetaParticipationForWorkspace } from "@/actions/beta";
import { BetaBlockedClient } from "@/components/beta/beta-blocked-client";

const WORKSPACE_COOKIE = "workspace_id";

export default async function BetaBlockedPage() {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspace } = await getResolvedWorkspaceContext(workspaceId);

  const participation = await getBetaParticipationForWorkspace(workspace?.id ?? null);

  const isBlocked = workspace?.id && participation && participation.status === "blocked";

  if (!workspace?.id || !isBlocked) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <BetaBlockedClient
      workspaceId={workspace.id}
      locale={locale}
      dataDeleteAfter={participation.dataDeleteAfter}
    />
  );
}
