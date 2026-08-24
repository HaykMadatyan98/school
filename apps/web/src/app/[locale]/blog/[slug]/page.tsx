import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BlogPostView } from "@/components/blog-post-view";
import { mediaUrl, tLocal } from "@/lib/api";
import { getPostBySlug } from "@/lib/public-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post" };

  const title = tLocal(post.title, locale);
  const description = tLocal(post.excerpt, locale) || undefined;
  const image = mediaUrl(post.coverImage) || undefined;

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${slug}`,
      images: image ? [{ url: image }] : undefined,
      publishedTime: post.publishedAt || undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  return <BlogPostView post={post} />;
}
