import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PostList } from "@/components/post-list";
import { BlogCategoryFilter, BlogHero } from "@/components/page-copy";
import { api, type Category, type Post } from "@/lib/api";
import { getCategories, PUBLIC_REVALIDATE } from "@/lib/public-data";
import { getTranslations, setRequestLocale } from "next-intl/server";

async function getData(category?: string) {
  try {
    const [posts, categories] = await Promise.all([
      api<Post[]>(`/posts${category ? `?category=${category}` : ""}`, {
        revalidate: PUBLIC_REVALIDATE,
        tags: ["posts"],
      }),
      getCategories(),
    ]);
    return { posts, categories };
  } catch {
    return { posts: [] as Post[], categories: [] as Category[] };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("blogTitle"),
    description: t("blogDescription"),
    openGraph: {
      title: t("blogTitle"),
      description: t("blogDescription"),
      url: "/blog",
    },
  };
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { category } = await searchParams;
  const { posts, categories } = await getData(category);

  return (
    <div>
      <div className="relative bg-ink">
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.25),transparent_45%)]" />
        <SiteHeader />
        <BlogHero />
      </div>

      <main className="mx-auto max-w-[var(--container)] px-[var(--space-page-x)] py-[var(--space-section)]">
        <BlogCategoryFilter categories={categories} active={category} />
        <PostList posts={posts} />
      </main>
      <SiteFooter />
    </div>
  );
}
