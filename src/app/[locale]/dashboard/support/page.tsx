import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getResolvedWorkspaceContext } from "@/actions/workspaces";
import { createClient } from "@/lib/supabase/server";
import { SupportRequestForm } from "@/components/settings/support-request-form";
import { MessageCircle } from "lucide-react";

const WORKSPACE_COOKIE = "workspace_id";

export default async function SupportPage() {
  const t = await getTranslations("settings");
  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const { workspaces, workspace } = await getResolvedWorkspaceContext(workspaceIdFromCookie);
  const currentWorkspaceId = workspace?.id ?? null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayEmail = user?.email ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-12">
      <header className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{t("supportPage.title")}</h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">
          {t("supportPage.subtitle")}
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle size={18} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t("supportPage.sectionTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("supportPage.sectionSubtitle")}
            </p>
          </div>
        </div>
        <SupportRequestForm
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspaceId}
          defaultEmail={displayEmail}
        />
      </section>
    </div>
  );
}
