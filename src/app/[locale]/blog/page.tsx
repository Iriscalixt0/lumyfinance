import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { BlogNav } from "@/components/blog/BlogNav";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { PRODUCT_CONFIG } from "@/lib/product-config";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lumyf.com";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const tBlog = await getTranslations({ locale, namespace: "blog" });
  const title = tBlog("meta.listTitle");
  const description = tBlog("meta.listDescription");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${locale}/blog`,
      siteName: "Lumyf",
      type: "website",
    },
    alternates: {
      canonical: `${BASE_URL}/${locale}/blog`,
    },
  };
}

export default async function BlogListPage({ params }: Props) {
  const { locale } = await params;
  const posts = await getAllPosts(locale);
  const tLanding = await getTranslations({ locale, namespace: "landing" });
  const tBlog = await getTranslations({ locale, namespace: "blog" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BlogNav />

      <section className="relative overflow-hidden px-4 py-16 text-center sm:px-6 sm:py-24">
        <div
          className="absolute inset-0 -z-10 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(160 45% 30%) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="mb-5 flex justify-center">
          <div className="rounded-2xl bg-secondary p-4 shadow-card">
            <Logo size="md" />
          </div>
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          {tBlog("hero.titlePrefix")}{" "}
          <span className="text-gradient-hero">Lumyf</span>
        </h1>

        <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
          {tBlog("hero.subtitle")}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {posts.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            {tBlog("list.empty")}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border px-4 py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{tLanding("cta.title")}</p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {tLanding("hero.cta", { trialDays: PRODUCT_CONFIG.trialDays })}
        </Link>
      </section>
    </div>
  );
}

