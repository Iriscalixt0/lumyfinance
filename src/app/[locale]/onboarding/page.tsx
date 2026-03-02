import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getWorkspacesForUser,
  ensureDefaultWorkspace,
} from "@/actions/workspaces";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";

const WORKSPACE_COOKIE = "workspace_id";
const PENDING_BETA_COOKIE = "pending_beta_token";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await getLocale();
  if (!user) {
    return redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, onboarding_intent")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed_at) {
    return redirect({ href: "/dashboard", locale });
  }

  let workspaces = await getWorkspacesForUser();
  const cookieStore = await cookies();
  const pendingBetaToken = cookieStore.get(PENDING_BETA_COOKIE)?.value ?? null;

  const hasBetaWorkspace = workspaces.some((w) => w.beta_program_id);
  if (pendingBetaToken && !hasBetaWorkspace) {
    const token = decodeURIComponent(pendingBetaToken).trim();
    if (token) {
      return redirect({ href: `/beta/${token}`, locale });
    }
  }

  if (workspaces.length === 0) {
    await ensureDefaultWorkspace();
    workspaces = await getWorkspacesForUser();
  }

  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const matchFromCookie =
    workspaceIdFromCookie && workspaces.find((w) => w.id === workspaceIdFromCookie);
  const betaWorkspace = workspaces.find((w) => w.beta_program_id);
  const defaultWorkspace =
    matchFromCookie ?? betaWorkspace ?? workspaces[0];

  const intent =
    (profile?.onboarding_intent as "personal" | "family" | "business" | "other") ??
    null;

  const isBetaWorkspace = !!defaultWorkspace?.beta_program_id;

  return (
    <OnboardingSteps
      initialIntent={intent}
      defaultWorkspaceId={defaultWorkspace?.id ?? null}
      defaultWorkspaceName={defaultWorkspace?.name ?? "Minhas Finanças"}
      isBetaWorkspace={isBetaWorkspace}
    />
  );
}
