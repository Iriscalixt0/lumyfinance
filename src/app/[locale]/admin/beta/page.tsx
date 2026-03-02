import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getBetaPrograms, isUserBetaAdmin } from "@/actions/beta";
import {
  getAllBetaFeedbacks,
  getBetaConversionStats,
  getBetaLeadsForExport,
  getOnboardingStats,
  getUserLocaleStats,
} from "@/actions/admin";
import { AdminBetaClient } from "@/components/beta/admin-beta-client";

export default async function AdminBetaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const isAdmin = await isUserBetaAdmin();
  if (!isAdmin) {
    const locale = await getLocale();
    redirect(`/${locale}/dashboard`);
  }

  const params = await searchParams;
  const initialTab =
    (params.tab as "programs" | "feedbacks" | "onboarding" | "regions") ??
    "programs";

  const [programs, feedbacks, onboardingStats, localeStats, conversionStats, betaLeads] = await Promise.all([
    getBetaPrograms(),
    getAllBetaFeedbacks(),
    getOnboardingStats(),
    getUserLocaleStats(),
    getBetaConversionStats(),
    getBetaLeadsForExport(),
  ]);

  const t = await getTranslations("admin");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>
      <AdminBetaClient
        programs={programs}
        feedbacks={feedbacks}
        onboardingStats={onboardingStats}
        localeStats={localeStats}
        conversionStats={conversionStats}
        betaLeads={betaLeads}
        initialTab={initialTab}
      />
    </div>
  );
}
