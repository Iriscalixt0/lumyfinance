import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function TermsPage() {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("legal.terms");
  const responsibilityKeys = ["item1", "item2", "item3", "item4"] as const;

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-16 text-foreground">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("updatedAt")}</p>

      <nav className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/privacy" className="text-primary hover:underline">
          {t("nav.privacy")}
        </Link>
        <Link href="/refund" className="text-primary hover:underline">
          {t("nav.refund")}
        </Link>
      </nav>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s1.title")}</h2>
          <p className="mt-2">{t("sections.s1.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s2.title")}</h2>
          <p className="mt-2">{t("sections.s2.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s3.title")}</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {responsibilityKeys.map((key) => (
              <li key={key}>{t(`sections.s3.${key}`)}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s4.title")}</h2>
          <p className="mt-2">
            {t("sections.s4.bodyBeforeLink")} {" "}
            <Link href="/refund" className="text-primary hover:underline">
              {t("sections.s4.linkLabel")}
            </Link>{" "}
            {t("sections.s4.bodyAfterLink")}
          </p>
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

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s8.title")}</h2>
          <p className="mt-2">{t("sections.s8.body")}</p>
        </div>
      </section>

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
        {tCommon("back")}
      </Link>
    </main>
  );
}
