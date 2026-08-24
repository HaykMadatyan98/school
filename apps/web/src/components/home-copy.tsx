"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LOGO_SRC } from "@/lib/brand";

export function HomeHero() {
  const t = useTranslations();

  return (
    <div className="relative mx-auto flex min-h-[100svh] max-w-[var(--container)] flex-col justify-end px-[var(--space-page-x)] pb-12 pt-32 sm:pb-16 sm:pt-36 md:pb-20">
      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          alt=""
          className="h-16 w-16 object-contain drop-shadow-lg sm:h-20 sm:w-20"
        />
      </div>
      <p className="text-eyebrow mb-3 max-w-xl text-white/70 sm:mb-4">
        {t("home.eyebrow")}
      </p>
      <h1 className="text-hero max-w-3xl text-white">{t("brand")}</h1>
      <p className="mt-4 max-w-xl text-[length:var(--text-lg)] leading-[var(--leading-relaxed)] text-white/85 sm:mt-5 md:text-[length:var(--text-xl)]">
        {t("home.lead")}
      </p>
      <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
        <Link
          href="/p/about"
          className="rounded-[var(--radius-sm)] bg-accent px-5 py-3 text-[length:var(--text-sm)] font-semibold text-white transition hover:bg-accent-deep"
        >
          {t("home.aboutCta")}
        </Link>
        <Link
          href="/search"
          className="rounded-[var(--radius-sm)] border border-white/35 bg-white/10 px-5 py-3 text-[length:var(--text-sm)] font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          {t("home.searchCta")}
        </Link>
      </div>
    </div>
  );
}

export function HomeLatestHeader() {
  const t = useTranslations();
  return (
    <div className="mb-8 max-w-2xl md:mb-10">
      <h2 className="text-section-title text-ink">{t("home.latest")}</h2>
      <p className="mt-3 text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-ink-soft">
        {t("home.latestLead")}
      </p>
    </div>
  );
}

export function HomeAllPostsLink() {
  const t = useTranslations();
  return (
    <Link
      href="/blog"
      className="text-[length:var(--text-sm)] font-semibold text-accent-deep hover:underline"
    >
      {t("home.allPosts")} →
    </Link>
  );
}
