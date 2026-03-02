import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, formatDate } from "@/lib/blog";
import { BlogNav } from "@/components/blog/BlogNav";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Calendar, Clock, ArrowLeft } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lumyf.com";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of routing.locales) {
    const posts = await getAllPosts(locale);
    for (const post of posts) {
      params.push({ locale, slug: post.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(locale, slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: `${BASE_URL}/${locale}/blog/${slug}`,
      siteName: "Lumyf",
      publishedTime: post.publishedAt,
    },
    alternates: {
      canonical: `${BASE_URL}/${locale}/blog/${slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  const post = await getPostBySlug(locale, slug);
  const tBlog = await getTranslations({ locale, namespace: "blog" });

  if (!post) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BlogNav />

      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden px-4 py-16 text-center sm:py-24"
        style={
          !post.coverImage
            ? { background: post.coverGradient }
            : { backgroundColor: "hsl(220 15% 18%)" }
        }
      >
        {post.coverImage && (
          <>
            <Image
              src={post.coverImage}
              alt=""
              fill
              className="object-cover opacity-60"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          </>
        )}
        {!post.coverImage && (
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />
        )}

        {!post.coverImage && (
          <span
            className="relative mb-5 select-none text-6xl drop-shadow-xl"
            role="img"
            aria-hidden="true"
          >
            {post.coverEmoji}
          </span>
        )}

        <div className="relative z-10 mb-4 flex flex-wrap justify-center gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="relative z-10 max-w-3xl text-2xl font-bold leading-tight text-white drop-shadow-lg sm:text-3xl md:text-4xl">
          {post.title}
        </h1>
      </div>

      <article className="mx-auto max-w-prose px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-5 border-b border-border pb-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            {formatDate(post.publishedAt, locale)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            {tBlog("article.readingTime", { minutes: post.readingTimeMinutes })}
          </span>
        </div>

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-12 border-t border-border pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {tBlog("article.backToBlog")}
          </Link>
        </div>
      </article>

      <section className="border-t border-border bg-secondary/30 px-4 py-12 text-center">
        <p className="mb-1 text-sm text-muted-foreground">
          {tBlog("article.ctaLead")}
        </p>
        <p className="mb-5 text-base font-semibold">{tBlog("article.ctaTitle")}</p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-hero-gradient px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {tBlog("article.ctaButton")}
        </Link>
      </section>
    </div>
  );
}

