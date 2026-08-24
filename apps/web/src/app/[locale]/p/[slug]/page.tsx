import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/cms-page-view";
import { mediaUrl, tLocal } from "@/lib/api";
import { getPageBySlug, getPageYears } from "@/lib/public-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return { title: "Page" };

  const title = tLocal(page.title, locale);
  const description = tLocal(page.excerpt, locale) || undefined;
  const image = mediaUrl(page.coverImage) || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/p/${slug}`,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function PublicCmsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const page = await getPageBySlug(slug);
  if (!page) notFound();

  const parentSlug = page.parentSlug || page.slug;
  const yearPages = await getPageYears(parentSlug);
  const parentPage = page.parentSlug
    ? await getPageBySlug(page.parentSlug)
    : null;

  return (
    <CmsPageView
      page={page}
      yearPages={yearPages}
      parentPage={parentPage}
    />
  );
}
