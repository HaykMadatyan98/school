import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PostList } from "@/components/post-list";
import {
  HomeAllPostsLink,
  HomeHero,
  HomeLatestHeader,
} from "@/components/home-copy";
import { getPublishedPosts } from "@/lib/public-data";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { absolute: t("homeTitle") },
    description: t("homeDescription"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = await getPublishedPosts();

  return (
    <div>
      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.25),transparent_45%)]" />
        <SiteHeader />
        <HomeHero />
      </div>

      <main className="mx-auto max-w-[var(--container)] px-[var(--space-page-x)] py-[var(--space-section)]">
        <HomeLatestHeader />
        <PostList posts={posts.slice(0, 6)} />
        <HomeAllPostsLink />
      </main>
      <SiteFooter />
    </div>
  );
}
