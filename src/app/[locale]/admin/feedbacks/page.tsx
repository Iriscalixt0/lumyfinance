import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export default async function AdminFeedbacksPage() {
  const { isUserBetaAdmin } = await import("@/actions/beta");
  const isAdmin = await isUserBetaAdmin();
  if (!isAdmin) {
    const locale = await getLocale();
    redirect(`/${locale}/dashboard`);
  }

  const locale = await getLocale();
  redirect(`/${locale}/admin/beta?tab=feedbacks`);
}
