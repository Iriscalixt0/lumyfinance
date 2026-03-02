import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PRODUCT_CONFIG } from "@/lib/product-config";

export default async function RefundPage() {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("legal.refund");

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-16 text-foreground">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("updatedAt")}</p>

      <nav className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/terms" className="text-primary hover:underline">
          {t("nav.terms")}
        </Link>
        <Link href="/privacy" className="text-primary hover:underline">
          {t("nav.privacy")}
        </Link>
      </nav>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s1.title")}</h2>
          <p className="mt-2">{t("sections.s1.body", { trialDays: PRODUCT_CONFIG.trialDays })}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s2.title")}</h2>
          <p className="mt-2">{t("sections.s2.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s3.title")}</h2>
          <p className="mt-2">{t("sections.s3.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s4.title")}</h2>
          <p className="mt-2">{t("sections.s4.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s5.title")}</h2>
          <p className="mt-2">{t("sections.s5.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s6.title")}</h2>
          <p className="mt-2">{t("sections.s6.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s7.title")}</h2>
          <p className="mt-2">{t("sections.s7.body")}</p>
        </div>
      </section>

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
        {tCommon("back")}
      </Link>
    </main>
  );
}
