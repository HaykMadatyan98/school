import type { MetadataRoute } from "next";
import { api, type Page, type Post } from "@/lib/api";
import { getSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  let posts: Post[] = [];
  let pages: Page[] = [];
  try {
    [posts, pages] = await Promise.all([
      api<Post[]>("/posts", { cache: "no-store" }),
      api<Page[]>("/pages", { cache: "no-store" }),
    ]);
  } catch {
    // API may be down during build — still emit static routes
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt || post.publishedAt || Date.now()),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const pageRoutes: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${base}/p/${page.slug}`,
    lastModified: new Date(page.updatedAt || Date.now()),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes, ...pageRoutes];
}
