"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Page } from "@/lib/api";

type Props = {
  years: Page[];
  activeSlug?: string;
  /** Compact row for year-page navigation */
  compact?: boolean;
};

export function YearPicker({ years, activeSlug, compact }: Props) {
  const t = useTranslations("pages");
  if (!years.length) return null;

  return (
    <div className={compact ? "mb-8" : "my-8"}>
      {!compact ? (
        <h2 className="mb-3 text-lg font-semibold text-ink">
          {t("chooseYear")}
        </h2>
      ) : (
        <p className="mb-2 text-sm font-medium text-ink-soft">
          {t("otherYears")}
        </p>
      )}
      <ul
        className={`flex flex-wrap gap-2 ${compact ? "" : "sm:gap-3"}`}
      >
        {years.map((y) => {
          const label = y.yearLabel || y.slug;
          const active = y.slug === activeSlug;
          return (
            <li key={y.id}>
              <Link
                href={`/p/${y.slug}`}
                className={`inline-flex min-w-[6.5rem] items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-[var(--line)] bg-white text-ink hover:border-accent hover:text-accent-deep"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
