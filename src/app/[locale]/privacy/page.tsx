import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function PrivacyPage() {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("legal.privacy");
  const collectedDataKeys = ["item1", "item2", "item3", "item4"] as const;
  const rightsKeys = ["right1", "right2", "right3", "right4", "right5", "right6"] as const;

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-5 py-10 sm:py-16 text-foreground">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("updatedAt")}</p>

      <nav className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/terms" className="text-primary hover:underline">
          {t("nav.terms")}
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
          <ul className="mt-2 list-inside list-disc space-y-1">
            {collectedDataKeys.map((key) => (
              <li key={key}>{t(`sections.s2.${key}`)}</li>
            ))}
          </ul>
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
          <ul className="mt-2 list-inside list-disc space-y-1">
            {rightsKeys.map((key) => (
              <li key={key}>{t(`sections.s6.${key}`)}</li>
            ))}
          </ul>
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

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s9.title")}</h2>
          <p className="mt-2">{t("sections.s9.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s10.title")}</h2>
          <p className="mt-2">{t("sections.s10.body")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">{t("sections.s11.title")}</h2>
          <p className="mt-2">{t("sections.s11.body")}</p>
        </div>
      </section>

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
        {tCommon("back")}
      </Link>
    </main>
  );
}
