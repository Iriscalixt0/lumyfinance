import { Link } from "@/i18n/navigation";
import { formatDate, type BlogPost } from "@/lib/blog";
import { Calendar, Clock } from "lucide-react";
import Image from "next/image";

interface BlogCardProps {
  post: BlogPost;
  locale: string;
}

export function BlogCard({ post, locale }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* ── Cover area ── */}
      <div
        className="relative h-48 flex items-center justify-center overflow-hidden bg-muted"
        style={!post.coverImage ? { background: post.coverGradient } : undefined}
      >
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <>
            {/* Dot pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />
            {/* Emoji icon */}
            <span
              className="relative text-5xl select-none drop-shadow-lg"
              role="img"
              aria-hidden="true"
            >
              {post.coverEmoji}
            </span>
          </>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="p-5 flex flex-col gap-3">
        {/* Title */}
        <h2 className="font-bold text-base sm:text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
          {post.title}
        </h2>

        {/* Excerpt */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {post.excerpt}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            {formatDate(post.publishedAt, locale)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            {post.readingTimeMinutes} min
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
