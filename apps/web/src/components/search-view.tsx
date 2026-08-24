"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAppLocale } from "@/components/locale-provider";
import { tLocal, type Page } from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";

export function SearchView({ pages }: { pages: Page[] }) {
  const t = useTranslations("search");
  const { locale } = useAppLocale();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return pages.filter((p) => {
      const title = tLocal(p.title, locale).toLowerCase();
      const excerpt = tLocal(p.excerpt, locale).toLowerCase();
      const content = tLocal(p.content, locale).toLowerCase();
      return (
        title.includes(needle) ||
        excerpt.includes(needle) ||
        content.includes(needle) ||
        p.slug.toLowerCase().includes(needle)
      );
    });
  }, [pages, q, locale]);

  return (
    <div>
      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.22),transparent_45%)]" />
        <SiteHeader />
        <div className="relative mx-auto flex max-w-[var(--container)] flex-col justify-end px-[var(--space-page-x)] pb-10 pt-32 md:pb-12 md:pt-36">
          <h1 className="text-page-title text-white">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-white/75">{t("lead")}</p>
        </div>
      </div>

      <main className="container-narrow py-[var(--space-section)]">
        <Breadcrumbs
          items={[
            { label: t("home"), href: "/" },
            { label: t("title") },
          ]}
        />
        <label className="block">
          <span className="sr-only">{t("title")}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("placeholder")}
            className="input-school text-[length:var(--text-base)]"
            autoFocus
          />
        </label>

        <div className="mt-8">
          {q.trim().length < 2 ? (
            <p className="text-ink-soft">{t("hint")}</p>
          ) : results.length === 0 ? (
            <p className="text-ink-soft">{t("empty")}</p>
          ) : (
            <ul className="grid gap-3">
              {results.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/p/${p.slug}`}
                    className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white/80 px-4 py-3 transition hover:border-accent/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={LOGO_SRC}
                      alt=""
                      className="mt-0.5 h-9 w-9 object-contain"
                    />
                    <span>
                      <span className="block font-semibold text-ink">
                        {tLocal(p.title, locale)}
                      </span>
                      {tLocal(p.excerpt, locale) && (
                        <span className="mt-1 block text-[length:var(--text-sm)] text-ink-soft">
                          {tLocal(p.excerpt, locale)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
