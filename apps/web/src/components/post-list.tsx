"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDate, tLocal, type Post } from "@/lib/api";
import { useAppLocale } from "@/components/locale-provider";
import { LOGO_SRC } from "@/lib/brand";

export function PostList({ posts }: { posts: Post[] }) {
  const t = useTranslations("blog");
  const { locale } = useAppLocale();

  if (!posts.length) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--line)] bg-white/60 px-6 py-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          alt=""
          className="mx-auto mb-4 h-14 w-14 object-contain opacity-90"
        />
        <p className="text-[length:var(--text-base)] text-ink-soft">{t("empty")}</p>
        <p className="mt-2 text-[length:var(--text-sm)] text-ink-soft/80">
          {t("emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:gap-10">
      {posts.map((post) => (
        <article
          key={post.id}
          className="grid gap-4 overflow-hidden sm:gap-5 md:grid-cols-[1.05fr_1fr]"
        >
          <Link
            href={`/blog/${post.slug}`}
            className="relative flex min-h-44 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-ink sm:min-h-52"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_SRC}
              alt=""
              className="h-20 w-20 object-contain opacity-95"
            />
          </Link>
          <div className="flex flex-col justify-center py-1 sm:py-2">
            <div className="text-eyebrow mb-2 flex flex-wrap items-center gap-2 text-ink-soft/80 sm:mb-3 sm:gap-3">
              {post.category && (
                <span>{tLocal(post.category.name, locale)}</span>
              )}
              <span>
                {formatDate(post.publishedAt || post.createdAt, locale)}
              </span>
            </div>
            <h2 className="text-section-title text-ink">
              <Link
                href={`/blog/${post.slug}`}
                className="hover:text-accent-deep"
              >
                {tLocal(post.title, locale)}
              </Link>
            </h2>
            {tLocal(post.excerpt, locale) && (
              <p className="mt-2 max-w-xl text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-ink-soft sm:mt-3">
                {tLocal(post.excerpt, locale)}
              </p>
            )}
            <Link
              href={`/blog/${post.slug}`}
              className="mt-4 inline-flex w-fit items-center gap-2 text-[length:var(--text-sm)] font-semibold text-accent-deep sm:mt-5"
            >
              {t("readMore")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
