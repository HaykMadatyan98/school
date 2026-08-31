"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { renderContent, stripDuplicateTitle } from "@/components/content";
import { useAppLocale } from "@/components/locale-provider";
import {
  formatDate,
  mediaUrl,
  tLocal,
  type Post,
} from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";

export function BlogPostView({ post }: { post: Post }) {
  const t = useTranslations("blog");
  const { locale } = useAppLocale();
  const title = tLocal(post.title, locale);
  const content = stripDuplicateTitle(tLocal(post.content, locale), title);

  return (
    <div>
      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.25),transparent_45%)]" />
          <div className="absolute right-8 top-28 opacity-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="" className="h-28 w-28 object-contain" />
          </div>
        </div>
        <SiteHeader />
        <div className="relative mx-auto flex max-w-[var(--container-narrow)] flex-col justify-end px-[var(--space-page-x)] pb-10 pt-32 md:pb-12 md:pt-36">
          <div className="text-eyebrow mb-3 flex flex-wrap gap-3 text-white/70">
            {post.category && <span>{tLocal(post.category.name, locale)}</span>}
            <span>
              {formatDate(post.publishedAt || post.createdAt, locale)}
            </span>
          </div>
          <h1 className="text-page-title text-white">{title}</h1>
        </div>
      </div>

      <article className="container-narrow py-[var(--space-section)]">
        <Breadcrumbs
          items={[
            { label: t("title"), href: "/blog" },
            { label: title },
          ]}
        />
        {tLocal(post.excerpt, locale) && (
          <p className="mb-8 border-l-2 border-accent pl-4 text-[length:var(--text-lg)] leading-[var(--leading-relaxed)] text-ink-soft">
            {tLocal(post.excerpt, locale)}
          </p>
        )}
        <div className="prose-school">{renderContent(content, mediaUrl)}</div>
        <div className="mt-10 md:mt-12">
          <Link
            href="/blog"
            className="text-[length:var(--text-sm)] font-semibold text-accent-deep"
          >
            ← {t("back")}
          </Link>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
