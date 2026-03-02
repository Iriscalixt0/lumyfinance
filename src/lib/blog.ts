export type BlogPost = {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  /** URL to cover image (takes precedence over gradient+emoji) */
  coverImage?: string;
  /** CSS linear-gradient string used as fallback when no coverImage */
  coverGradient: string;
  /** Emoji displayed on cover (fallback when no coverImage) */
  coverEmoji: string;
  /** ISO 8601 date string e.g. "2026-02-10" */
  publishedAt: string;
  readingTimeMinutes: number;
  tags: string[];
  /** Full article body as an HTML string */
  content: string;
};

// ─── Post registry ────────────────────────────────────────────────────────────
// To add a new locale: create src/content/blog/<locale>/index.ts that exports
// a `posts` array, then register the loader below.

type PostLoader = () => Promise<{ posts: BlogPost[] }>;

const loaders: Record<string, PostLoader> = {
  "pt-BR": () =>
    import("@/content/blog/pt-BR/index").then((m) => ({ posts: m.posts })),
  "pt-PT": () =>
    import("@/content/blog/pt-BR/index").then((m) => ({ posts: m.posts })), // fallback
  en: () =>
    import("@/content/blog/en/index").then((m) => ({ posts: m.posts })),
  es: () =>
    import("@/content/blog/es/index").then((m) => ({ posts: m.posts })),
};

function getLoader(locale: string): PostLoader {
  if (loaders[locale]) return loaders[locale];
  // Try language prefix (e.g. "en-GB" → "en")
  const lang = locale.split("-")[0];
  if (loaders[lang]) return loaders[lang];
  // Default fallback to pt-BR
  return loaders["pt-BR"];
}

export async function getAllPosts(locale: string): Promise<BlogPost[]> {
  const { posts } = await getLoader(locale)();
  return [...posts].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export async function getPostBySlug(
  locale: string,
  slug: string
): Promise<BlogPost | null> {
  const posts = await getAllPosts(locale);
  return posts.find((p) => p.slug === slug) ?? null;
}

export function formatDate(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}
