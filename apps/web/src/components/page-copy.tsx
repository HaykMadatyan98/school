"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useAppLocale } from "@/components/locale-provider";
import { tLocal } from "@/lib/api";
import type { Category } from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";

export function BlogHero() {
  const t = useTranslations("blog");
  return (
    <div className="relative mx-auto flex items-end px-[var(--space-page-x)] pb-10 pt-32 md:pt-36">
      <div>
        <h1 className="text-page-title text-white">{t("title")}</h1>
        <p className="mt-2 max-w-xl text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-white/80 md:text-[length:var(--text-lg)]">
          {t("lead")}
        </p>
      </div>
    </div>
  );
}

export function BlogCategoryFilter({
  categories,
  active,
}: {
  categories: Category[];
  active?: string;
}) {
  const t = useTranslations("blog");
  const { locale } = useAppLocale();

  if (!categories.length) return null;

  return (
    <div className="mb-8 flex flex-wrap gap-2 md:mb-10">
      <Link
        href="/blog"
        className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--text-sm)] ${
          !active
            ? "bg-ink text-white"
            : "bg-white/70 text-ink-soft hover:bg-white"
        }`}
      >
        {t("all")}
      </Link>
      {categories.map((item) => (
        <Link
          key={item.id}
          href={`/blog?category=${item.slug}`}
          className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--text-sm)] ${
            active === item.slug
              ? "bg-ink text-white"
              : "bg-white/70 text-ink-soft hover:bg-white"
          }`}
        >
          {tLocal(item.name, locale)}
        </Link>
      ))}
    </div>
  );
}

export function AboutContent() {
  const t = useTranslations("about");
  return (
    <>
      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.25),transparent_45%)]" />
          <div className="absolute right-8 top-24 opacity-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="" className="h-28 w-28 object-contain" />
          </div>
        </div>
        <SiteHeader />
        <div className="relative mx-auto flex items-end px-[var(--space-page-x)] pb-10 pt-32 md:pt-36">
          <h1 className="text-page-title text-white">{t("title")}</h1>
        </div>
      </div>

      <main className="container-narrow py-[var(--space-section)]">
        <p className="text-[length:var(--text-lg)] leading-[var(--leading-relaxed)] text-ink-soft">
          {t("body")}
        </p>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-section-title text-ink">{t("mission")}</h2>
            <p className="mt-3 text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-ink-soft">
              {t("missionBody")}
            </p>
          </div>
          <div>
            <h2 className="text-section-title text-ink">{t("contacts")}</h2>
            <p className="mt-3 text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-ink-soft">
              {t("address")}
              <br />
              {t("phone")}
              <br />
              {t("email")}
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
