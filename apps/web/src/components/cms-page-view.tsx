"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { YearPicker } from "@/components/year-picker";
import {
  renderContent,
  stripDuplicateTitle,
  stripRedundantYearNav,
} from "@/components/content";
import { useAppLocale } from "@/components/locale-provider";
import { mediaUrl, tLocal, type Page } from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";
import { isPeopleListPage } from "@/lib/staff-content";

/** Drop duplicate H2 + keep a short lead before staff cards. */
function splitStaffContent(content: string, title: string) {
  const marker = content.indexOf(":::person");
  if (marker < 0) return { lead: "", body: content };

  let head = content.slice(0, marker).trim();
  const body = content.slice(marker).trim();

  head = head.replace(/^##\s+.+$/m, "").trim();
  const paras = head
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let lead = paras[0] || "";
  if (lead.length > 220) {
    lead = `${lead.slice(0, 200).replace(/\s+\S*$/, "")}…`;
  }
  if (lead === title || /^##\s/.test(lead)) lead = "";

  return { lead, body };
}

function preparePageContent(
  raw: string,
  title: string,
  opts: { hasYearPicker: boolean },
) {
  // Raw Weebly HTML — do not run markdown chrome strippers
  if (/:::wsite-html/.test(raw)) return raw;
  let next = stripDuplicateTitle(raw, title);
  if (opts.hasYearPicker) next = stripRedundantYearNav(next);
  return next;
}

type Props = {
  page: Page;
  yearPages?: Page[];
  parentPage?: Page | null;
};

export function CmsPageView({ page, yearPages = [], parentPage = null }: Props) {
  const t = useTranslations("pages");
  const { locale } = useAppLocale();
  const title = tLocal(page.title, locale);
  const isYearPage = Boolean(page.parentSlug && page.yearLabel);
  const showYearGrid = !isYearPage && yearPages.length > 0;
  const hasYearPicker = showYearGrid || (isYearPage && yearPages.length > 1);
  const content = preparePageContent(
    tLocal(page.content, locale),
    title,
    { hasYearPicker },
  );
  const hasStaffCards = content.includes(":::person");
  const staff = hasStaffCards
    ? splitStaffContent(content, title)
    : { lead: "", body: content };

  const crumbs = [
    { label: t("home"), href: "/" as const },
    ...(parentPage
      ? [
          {
            label: tLocal(parentPage.title, locale),
            href: `/p/${parentPage.slug}` as const,
          },
        ]
      : []),
    {
      label:
        isYearPage && page.yearLabel ? page.yearLabel : title,
    },
  ];

  return (
    <div>
      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,119,6,0.28),transparent_42%),radial-gradient(circle_at_90%_0%,rgba(14,116,144,0.2),transparent_40%)]" />
          <div className="absolute right-6 top-[calc((100%-120px)/2+120px)] hidden -translate-y-1/2 opacity-25 md:block lg:right-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_SRC}
              alt=""
              className="h-28 w-28 object-contain lg:h-36 lg:w-36"
            />
          </div>
        </div>
        <SiteHeader />
        <div className="relative mx-auto flex flex-col justify-end px-[var(--space-page-x)] pb-10 pt-32 md:pb-12 md:pt-36">
          <Breadcrumbs items={crumbs} onDark />
          <h1 className="text-page-title max-w-4xl text-white">
            {isYearPage && parentPage
              ? `${tLocal(parentPage.title, locale)} · ${page.yearLabel}`
              : title}
          </h1>
          {tLocal(page.excerpt, locale) && (
            <p className="mt-3 max-w-2xl text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-white/80 md:mt-4 md:text-[length:var(--text-lg)]">
              {tLocal(page.excerpt, locale)}
            </p>
          )}
        </div>
      </div>

      <article
        className={`mx-auto px-[var(--space-page-x)] py-[var(--space-section)] ${
          hasStaffCards
            ? "max-w-[var(--container)]"
            : "max-w-[var(--container-narrow)]"
        }`}
      >
        {showYearGrid ? <YearPicker years={yearPages} /> : null}
        {isYearPage && yearPages.length > 1 ? (
          <YearPicker years={yearPages} activeSlug={page.slug} compact />
        ) : null}

        {hasStaffCards ? (
          <div>
            {staff.lead ? (
              <p className="mb-8 max-w-3xl text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-ink-soft md:mb-10 md:text-[length:var(--text-lg)]">
                {staff.lead}
              </p>
            ) : null}
            <div className="prose-school">
              {renderContent(staff.body, mediaUrl, {
                peopleLayout: isPeopleListPage(page.slug) ? "list" : "cards",
              })}
            </div>
          </div>
        ) : (
          <div className="prose-school">
            {renderContent(content, mediaUrl)}
          </div>
        )}
        {parentPage ? (
          <div className="mt-10 md:mt-12">
            <Link
              href={`/p/${parentPage.slug}`}
              className="text-[length:var(--text-sm)] font-semibold text-accent-deep"
            >
              ← {tLocal(parentPage.title, locale)}
            </Link>
          </div>
        ) : null}
      </article>
      <SiteFooter />
    </div>
  );
}
