import { getTranslations } from "next-intl/server";
import { AccessibilityPageContent } from "@/components/accessibility/accessibility-page-content";

export default async function AcessibilidadePage() {
  const t = await getTranslations("accessibility");
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-16 text-foreground">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
      <AccessibilityPageContent />
    </main>
  );
}
